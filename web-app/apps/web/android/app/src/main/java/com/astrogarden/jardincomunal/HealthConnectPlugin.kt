package com.astrogarden.jardincomunal

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Reads the phone's Health Connect data for the medical terminal's "Sync now"
 * (same approach as the AstroConnect app). Only reads; nothing is written or sent anywhere.
 *
 * JS side: health/health-connect-wearable.ts.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    /** AVAILABLE, NEEDS_UPDATE (the Health Connect app must be installed or updated) or NOT_SUPPORTED. */
    @PluginMethod
    fun availability(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "AVAILABLE"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "NEEDS_UPDATE"
            else -> "NOT_SUPPORTED"
        }
        call.resolve(JSObject().put("status", status))
    }

    /** Asks for whatever read permission is missing (Health Connect's own dialog), then resolves with what was granted. */
    @PluginMethod
    fun authorize(call: PluginCall) {
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(PERMISSIONS)) {
                    call.resolve(grantedResult(granted))
                } else {
                    val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, PERMISSIONS)
                    startActivityForResult(call, intent, "authorizeResult")
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                call.reject(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    @ActivityCallback
    private fun authorizeResult(call: PluginCall?, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (call == null) return
        // The dialog's own result only lists what was just granted; ask Health Connect for the full set.
        scope.launch {
            try {
                call.resolve(grantedResult(client.permissionController.getGrantedPermissions()))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                call.reject(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    /**
     * Today's readings, for every permission granted. A missing field means no data
     * (or no permission); one failing read doesn't stop the others.
     */
    @PluginMethod
    fun readToday(call: PluginCall) {
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                val zone = ZoneId.systemDefault()
                val now = Instant.now()
                val today = TimeRangeFilter.between(LocalDate.now(zone).atStartOfDay(zone).toInstant(), now)
                val out = JSObject()

                if (RESTING_HEART_RATE in granted) tryRead {
                    val r = client.aggregate(AggregateRequest(setOf(RestingHeartRateRecord.BPM_AVG), today))
                    out.put("restingHeartRateTodayBpm", r[RestingHeartRateRecord.BPM_AVG])
                }

                if (HEART_RATE in granted) {
                    tryRead {
                        val r = client.aggregate(AggregateRequest(setOf(HeartRateRecord.BPM_AVG), today))
                        out.put("heartRateAvgTodayBpm", r[HeartRateRecord.BPM_AVG])
                    }
                    tryRead {
                        val latest = client.readRecords(
                            ReadRecordsRequest(
                                recordType = HeartRateRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(now.minus(Duration.ofHours(24)), now),
                                ascendingOrder = false,
                                pageSize = 1,
                            )
                        ).records.firstOrNull()?.samples?.maxByOrNull { it.time }
                        if (latest != null) {
                            out.put("heartRateLatestBpm", latest.beatsPerMinute)
                            out.put("heartRateLatestTime", latest.time.toString())
                        }
                    }
                }

                if (SLEEP in granted) tryRead {
                    val r = client.aggregate(
                        AggregateRequest(
                            setOf(SleepSessionRecord.SLEEP_DURATION_TOTAL),
                            TimeRangeFilter.between(now.minus(Duration.ofHours(24)), now),
                        )
                    )
                    out.put("sleepLast24hMinutes", r[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMinutes())
                }

                if (EXERCISE in granted) tryRead {
                    val r = client.aggregate(AggregateRequest(setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL), today))
                    out.put("exerciseTodayMinutes", r[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes())
                }

                out.put("granted", JSArray(granted.intersect(PERMISSIONS).map(::shortName)))
                call.resolve(out)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                call.reject(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    private inline fun tryRead(block: () -> Unit) {
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Leave this reading out; the rest still sync.
        }
    }

    private fun grantedResult(granted: Set<String>) =
        JSObject().put("granted", JSArray(granted.intersect(PERMISSIONS).map(::shortName)))

    /** "android.permission.health.READ_SLEEP" → "READ_SLEEP". */
    private fun shortName(permission: String) = permission.substringAfterLast('.')

    companion object {
        val HEART_RATE = HealthPermission.getReadPermission(HeartRateRecord::class)
        val RESTING_HEART_RATE = HealthPermission.getReadPermission(RestingHeartRateRecord::class)
        val SLEEP = HealthPermission.getReadPermission(SleepSessionRecord::class)
        val EXERCISE = HealthPermission.getReadPermission(ExerciseSessionRecord::class)

        /** Must match the <uses-permission> entries in AndroidManifest.xml. */
        val PERMISSIONS = setOf(HEART_RATE, RESTING_HEART_RATE, SLEEP, EXERCISE)
    }
}
