package com.astrogarden.jardincomunal

import android.app.Activity
import android.os.Bundle
import android.util.TypedValue
import android.widget.ScrollView
import android.widget.TextView

/**
 * What Health Connect shows when someone asks why the app wants their health data.
 * Health Connect requires it: without it, the permission dialog never opens.
 *
 * TODO: replace with the real privacy policy before publishing.
 */
class HealthPrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val text = TextView(this).apply {
            setPadding(pad, pad, pad, pad)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            text = buildString {
                append("Privacy\n\n")
                append("Jardín Comunal reads your heart rate, resting heart rate, sleep and exercise from ")
                append("Health Connect when you tap \"Sync now\" at the medical terminal. They become ")
                append("today's check-in in the game.\n\n")
                append("Nothing is written to Health Connect. Only you can see your health readings in the game. ")
                append("You can remove these permissions at any time in Health Connect's settings.")
            }
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}
