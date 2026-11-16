/** health */
export const ES_HEALTH: Record<string, string> = {
  // Metric labels (shared/contracts/health.ts)
  'Heart rate': 'Ritmo cardiaco',
  Sleep: 'Sueño',
  Exercise: 'Ejercicio',
  Mood: 'Ánimo',
  Water: 'Agua',
  Radiation: 'Radiación',
  'Body temperature': 'Temperatura',
  Stress: 'Estrés',
  Calories: 'Calorías',
  'Cabin CO₂': 'CO₂ de cabina',

  // Metric explanations (shared/contracts/health.ts)
  'Beats per minute at rest. Your own trend over several days tells you more than any single reading.':
    'Latidos por minuto en reposo. Tu tendencia de varios días dice más que una sola lectura.',
  'Hours in your last sleep period. Schedules shift a lot in orbit; logging it helps you spot your own patterns.':
    'Horas de tu último periodo de sueño. En órbita los horarios cambian mucho; registrarlo te ayuda a ver tus patrones.',
  'Minutes of exercise today: treadmill, bike or resistance training.':
    'Minutos de ejercicio hoy: caminadora, bici o entrenamiento de fuerza.',
  'How you feel, on your own 1–5 scale. It is only for you, and nothing is inferred from it.':
    'Cómo te sientes, en tu propia escala del 1 al 5. Es solo para ti y no se saca ninguna conclusión de ello.',
  'Litres you drank today. Fluids shift toward your head in microgravity, so thirst is a less reliable signal up here.':
    'Litros que tomaste hoy. En microgravedad los líquidos suben hacia la cabeza, así que aquí la sed avisa menos.',
  'Dose from your personal dosimeter over the last day. Logging it builds your own exposure record over the mission.':
    'Dosis de tu dosímetro personal en el último día. Registrarla arma tu historial de exposición en la misión.',
  'Your temperature today. In orbit it tends to run a little warmer than on Earth.':
    'Tu temperatura de hoy. En órbita suele ser un poco más alta que en la Tierra.',
  'How tense you feel, from low to too high. Some pressure helps you focus; too much is worth a breather.':
    'Qué tan tenso te sientes, de bajo a demasiado. Algo de presión ayuda a enfocarte; si es mucha, toma un respiro.',
  'Roughly what you ate today. The galley plans meals around about 2,500 kcal a day.':
    'Más o menos lo que comiste hoy. La cocina planea las comidas en unas 2,500 kcal al día.',
  "Carbon dioxide in the cabin air, from the station's sensors. The scrubbers keep it in check.":
    'Dióxido de carbono en el aire de la cabina, según los sensores de la estación. Los filtros lo mantienen a raya.',
  'Hours you slept last night. Your own pattern over the week tells you more than any single night.':
    'Horas que dormiste anoche. Tu patrón de la semana dice más que una sola noche.',
  'Minutes of exercise today: a brisk walk, a bike ride, sport or the gym.':
    'Minutos de ejercicio hoy: una caminata rápida, bici, deporte o gimnasio.',
  'Litres you drank today, water and other drinks included.': 'Litros que tomaste hoy, agua y otras bebidas incluidas.',

  // Validation (shared/contracts/health.ts)
  'Unknown metric': 'Lectura desconocida',
  'Enter a number': 'Escribe un número',
  'Between {min} and {max} {unit}': 'Entre {min} y {max} {unit}',

  // Mood faces and stress choices (format.ts, shared/contracts/checkin.ts)
  Low: 'Bajo',
  Meh: 'Más o menos',
  Okay: 'Normal',
  Good: 'Bien',
  Great: 'Genial',
  Moderate: 'Moderado',
  Optimal: 'Óptimo',
  High: 'Alto',
  'Too high': 'Muy alto',

  // Time and sources (format.ts)
  'just now': 'justo ahora',
  '{n} min ago': 'hace {n} min',
  '{n} h ago': 'hace {n} h',
  yesterday: 'ayer',
  '{n} days ago': 'hace {n} días',
  '⚙ Simulated': '⚙ Simulado',
  '✎ Entered by you': '✎ Escrito por ti',
  '⌚ Device': '⌚ Dispositivo',
  '⚙ sim': '⚙ sim',
  '✎ you': '✎ tú',
  '⌚ device': '⌚ disp.',

  // Comparisons (format.ts)
  'Your usual range appears after a few more days.': 'Tu rango habitual aparecerá en unos días más.',
  'Within your usual': 'Dentro de tu rango habitual',
  'Higher than your usual': 'Más alto que tu habitual',
  'Lower than your usual': 'Más bajo que tu habitual',

  // Trend chart
  goal: 'meta',
  'A trend appears after two days of readings.': 'La tendencia aparece tras dos días de lecturas.',
  '{metric}, {n} days, from {from} to {to}': '{metric}, {n} días, de {from} a {to}',

  // Metric detail
  'All metrics': 'Todas las lecturas',
  Period: 'Periodo',
  '{n} days': '{n} días',
  Chart: 'Gráfica',
  'Your usual': 'Tu habitual',
  'Your goal': 'Tu meta',
  Latest: 'Última',
  '{n}-day total': 'Total {n} días',
  Average: 'Promedio',
  Highest: 'Máximo',
  Lowest: 'Mínimo',
  'Daily goal': 'Meta diaria',
  'Lower the {metric} goal': 'Bajar la meta de {metric}',
  'Raise the {metric} goal': 'Subir la meta de {metric}',
  'Not logged today. Reaching it pays +{n} seeds.': 'Sin registro hoy. Cumplirla da +{n} semillas.',
  'Reached today ({amount}).': 'Cumplida hoy ({amount}).',
  '{amount} so far today. Reaching it pays +{n} seeds.': '{amount} hoy por ahora. Cumplirla da +{n} semillas.',
  'Readings · newest first': 'Lecturas · recientes primero',
  'No readings in this period.': 'Sin lecturas en este periodo.',

  // Health Insights
  'Streak and goals': 'Racha y metas',
  '{n}-day streak': 'Racha de {n} días',
  'No streak yet': 'Aún sin racha',
  'Check in today to keep it going.': 'Haz tu chequeo hoy para seguirla.',
  'Check in today to start one.': 'Haz tu chequeo hoy para empezar una.',
  '+{amount} seeds at {days} days.': '+{amount} semillas a los {days} días.',
  'Every day counts.': 'Cada día cuenta.',
  "Today's goals": 'Metas de hoy',
  Metrics: 'Lecturas',
  '{metric}: details': '{metric}: detalles',
  '7-day total {amount}': 'Total 7 días: {amount}',
  'No readings yet.': 'Aún sin lecturas.',
  'Metric pages': 'Páginas de lecturas',
  'Previous metrics': 'Lecturas anteriores',
  'Next metrics': 'Lecturas siguientes',
  'Private to you: your own readings, compared only with your own usual. Not a diagnosis; if something worries you, talk to your flight surgeon.':
    'Solo para ti: tus lecturas, comparadas solo con tu habitual. No es un diagnóstico; si algo te preocupa, habla con tu médico de vuelo.',
  '{metric} goal {target}: not logged today': 'Meta de {metric} {target}: sin registro hoy',
  '{metric}: {value} of {target}': '{metric}: {value} de {target}',
  '{metric}: {value} of {target}, reached': '{metric}: {value} de {target}, cumplida',
  '{a} and {b}': '{a} y {b}',

  // Medical Terminal
  'How to add readings': 'Cómo agregar lecturas',
  'Wearable sync': 'Sincronizar',
  'Enter manually': 'A mano',
  'Simulated wearable': 'Dispositivo simulado',
  'Health Connect': 'Health Connect',
  'Demo data': 'Datos demo',
  'Syncing…': 'Sincronizando…',
  Connected: 'Conectado',
  'On this phone': 'En este teléfono',
  'Last synced {ago}': 'Sincronizado {ago}',
  'Not synced yet': 'Aún sin sincronizar',
  'Sync now': 'Sincronizar',
  "Today's check-in": 'Chequeo de hoy',
  'Readings today': 'Lecturas de hoy',
  "Don't know": 'No sé',
  'Enter it': 'Anotar',
  Missing: 'Falta',
  "The wearable can't read mood. How are you feeling?": 'El dispositivo no mide el ánimo. ¿Cómo te sientes?',
  'All done for today': 'Listo por hoy',
  'Readings by crew member': 'Lecturas por tripulante',
  Medic: 'Médico',
  Trainer: 'Entrenador',
  Chef: 'Chef',
  Science: 'Ciencia',
  'Has values to save': 'Tiene valores sin guardar',
  "Fill in any tab; you don't need all of them. One save stores everything you entered.":
    'Llena las pestañas que quieras; no hacen falta todas. Un solo guardado guarda todo.',
  'Save check-in': 'Guardar chequeo',
  'Quick mood check-in': 'Chequeo rápido de ánimo',
  'Mood: {mood}': 'Ánimo: {mood}',
  'How are you feeling?': '¿Cómo te sientes?',
  'Only you can see your health data.': 'Solo tú ves tus datos de salud.',
  '+{n} seeds for checking in': '+{n} semillas por tu chequeo',
  '+{n} seeds earned': '+{n} semillas ganadas',
  '+{n} seeds': '+{n} semillas',
  "Saved. Today's seeds for these are already yours": 'Guardado. Las semillas de hoy por esto ya son tuyas',
  Saved: 'Guardado',
  'Saved. Already earned today': 'Guardado. Ya ganadas hoy',
  'Saved.': 'Guardado.',
  '{bonus}: +{n} seeds': '{bonus}: +{n} semillas',
  '+{n} bonus': '+{n} extra',
  'Check in to earn seeds': 'Chequéate y gana semillas',
  '{metric} goal': 'Meta de {metric}',

  // Sync and save errors (health.store.ts, health-connect-wearable.ts, session)
  "Couldn't sync. Try again in a moment.": 'No se pudo sincronizar. Inténtalo en un momento.',
  "Couldn't save that. Try again in a moment.": 'No se pudo guardar. Inténtalo en un momento.',
  "Can't reach the station. Try again.": 'Sin conexión con la estación. Inténtalo de nuevo.',
  'Install or update the Health Connect app, then try again.': 'Instala o actualiza la app Health Connect y vuelve a intentarlo.',
  "This phone doesn't support Health Connect.": 'Este teléfono no es compatible con Health Connect.',
  'Allow access in Health Connect to sync your readings.': 'Permite el acceso en Health Connect para sincronizar tus lecturas.',
  'Health Connect has no heart rate, sleep, steps or exercise for today yet. Sync your watch or health app first.':
    'Health Connect aún no tiene ritmo cardiaco, sueño, pasos ni ejercicio de hoy. Sincroniza primero tu reloj o app de salud.',
};
