import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Configuración global de cómo se manejan las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
    this.isInitialized = false;
  }

  // Función principal para inicializar el servicio de notificaciones
  // En tu NotificationService.js, mejoremos la función initialize
async initialize(userId) {
  if (this.isInitialized) {
    console.log('🔔 NotificationService: Ya inicializado');
    return;
  }

  try {
    console.log('🔔 NotificationService: Inicializando...');

    // Verificamos el entorno de ejecución de manera más inteligente
    if (!Device.isDevice) {
      console.log('🔔 NotificationService: Ejecutándose en simulador - funcionalidad limitada');
      this.isInitialized = true;
      return;
    }

    // En builds reales, esto funcionará perfectamente
    // En Expo Go, manejamos el error graciosamente
    const permissionStatus = await this.requestPermissions();
    if (permissionStatus !== 'granted') {
      console.log('🔔 NotificationService: Permisos no concedidos');
      this.isInitialized = true;
      return;
    }

    // Intentamos obtener el token, pero manejamos errores de configuración
    try {
      const token = await this.getExpoPushToken();
      if (token && userId) {
        await this.savePushToken(userId, token);
      }
    } catch (tokenError) {
      // En builds reales esto funcionará, en desarrollo podemos continuar sin token
      console.log('🔔 NotificationService: Token no disponible en este entorno, continuando...');
    }

    // El resto de la configuración sí funciona en todos los entornos
    this.setupNotificationListeners();
    
    if (Platform.OS === 'android') {
      await this.setupAndroidNotificationChannel();
    }

    this.isInitialized = true;
    console.log('✅ NotificationService: Inicialización completa');

  } catch (error) {
    console.error('❌ NotificationService: Error en inicialización:', error);
    // Incluso si hay errores, marcamos como inicializado para evitar loops infinitos
    this.isInitialized = true;
  }
}

  // Función para obtener el token de Expo Push
  async getExpoPushToken() {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('🔔 NotificationService: Token obtenido:', token.slice(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('❌ NotificationService: Error obteniendo token:', error);
      return null;
    }
  }

  // Función para guardar el token en la base de datos
  async savePushToken(userId, token) {
    try {
      console.log('💾 NotificationService: Guardando token para usuario:', userId);

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          { 
            user_id: userId, 
            push_token: token,
            updated_at: new Date().toISOString()
          },
          { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          }
        );

      if (error) {
        console.error('❌ NotificationService: Error guardando token:', error);
        return;
      }

      console.log('✅ NotificationService: Token guardado exitosamente');

    } catch (error) {
      console.error('❌ NotificationService: Error inesperado guardando token:', error);
    }
  }

  // Función para configurar listeners de notificaciones
  setupNotificationListeners() {
    console.log('🔔 NotificationService: Configurando listeners...');

    // Listener para notificaciones recibidas mientras la app está en foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 NotificationService: Notificación recibida:', notification.request.content.title);
      this.handleNotificationReceived(notification);
    });

    // Listener para cuando el usuario toca una notificación
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 NotificationService: Notificación tocada:', response.notification.request.content.title);
      this.handleNotificationResponse(response);
    });
  }

  // Función para manejar notificaciones recibidas
  handleNotificationReceived(notification) {
    const { title, body, data } = notification.request.content;
    
    // Aquí puedes añadir lógica personalizada para diferentes tipos de notificaciones
    console.log('📱 Notificación en foreground:', { title, body, data });

    // Podrías mostrar una notificación in-app personalizada
    // o actualizar el estado de la aplicación según el tipo de notificación
  }

  // Función para manejar respuestas a notificaciones (cuando el usuario las toca)
  handleNotificationResponse(response) {
    const { title, body, data } = response.notification.request.content;
    
    console.log('👆 Usuario tocó notificación:', { title, body, data });

    // Aquí puedes navegar a pantallas específicas según el tipo de notificación
    if (data && data.action_url) {
      console.log('🧭 Navegando a:', data.action_url);
      // Aquí integrarías con tu sistema de navegación
      // navigation.navigate(data.action_url);
    }
  }

  // Función para configurar canal de notificación en Android
  async setupAndroidNotificationChannel() {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones de Hábitos',
        description: 'Recordatorios y actualizaciones de tu aplicación de hábitos',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3498db',
        sound: true,
      });

      // Canal para recordatorios importantes
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Recordatorios de Hábitos',
        description: 'Recordatorios diarios para completar tus hábitos',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f39c12',
        sound: true,
      });

      // Canal para actividad social
      await Notifications.setNotificationChannelAsync('social', {
        name: 'Actividad Social',
        description: 'Actividad en tus grupos y hábitos compartidos',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150, 150, 150],
        lightColor: '#27ae60',
        sound: true,
      });

      console.log('✅ NotificationService: Canales de Android configurados');

    } catch (error) {
      console.error('❌ NotificationService: Error configurando canales Android:', error);
    }
  }

  // Función para programar una notificación local
  async scheduleLocalNotification(title, body, data = {}, scheduledTime = null) {
    try {
      console.log('📅 NotificationService: Programando notificación local:', title);

      const notificationContent = {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: data.type || 'default',
      };

      let trigger = null;
      if (scheduledTime) {
        trigger = {
          date: new Date(scheduledTime),
        };
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger,
      });

      console.log('✅ NotificationService: Notificación programada con ID:', identifier);
      return identifier;

    } catch (error) {
      console.error('❌ NotificationService: Error programando notificación:', error);
      return null;
    }
  }

  // Función para cancelar notificaciones programadas
  async cancelScheduledNotification(identifier) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('✅ NotificationService: Notificación cancelada:', identifier);
    } catch (error) {
      console.error('❌ NotificationService: Error cancelando notificación:', error);
    }
  }

  // Función para cancelar todas las notificaciones programadas
  async cancelAllScheduledNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ NotificationService: Todas las notificaciones canceladas');
    } catch (error) {
      console.error('❌ NotificationService: Error cancelando todas las notificaciones:', error);
    }
  }

  // Función para obtener el badge count actual
  async getBadgeCount() {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
    } catch (error) {
      console.error('❌ NotificationService: Error obteniendo badge count:', error);
      return 0;
    }
  }

  // Función para establecer el badge count
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('✅ NotificationService: Badge count establecido:', count);
    } catch (error) {
      console.error('❌ NotificationService: Error estableciendo badge count:', error);
    }
  }

  // Función para crear notificaciones de recordatorio de hábitos
  async createHabitReminder(habitName, scheduledTime) {
    return await this.scheduleLocalNotification(
      '⏰ Recordatorio de Hábito',
      `¡Es hora de trabajar en "${habitName}"! Mantén tu racha activa.`,
      {
        type: 'habit_reminder',
        habit_name: habitName,
        action_url: '/habits'
      },
      scheduledTime
    );
  }

  // Función para crear notificación de celebración de racha
  async createStreakCelebration(habitName, streakDays) {
    const celebrationMessages = {
      7: `🎉 ¡Una semana completa con "${habitName}"! ¡Increíble disciplina!`,
      14: `🔥 ¡Dos semanas seguidas con "${habitName}"! ¡Imparable!`,
      30: `🏆 ¡Un mes entero con "${habitName}"! ¡Eres una leyenda!`,
      100: `👑 ¡100 días con "${habitName}"! ¡Nivel élite alcanzado!`
    };

    const message = celebrationMessages[streakDays] || 
      `🎯 ¡${streakDays} días seguidos con "${habitName}"! ¡Sigue así!`;

    return await this.scheduleLocalNotification(
      '🎉 ¡Celebremos tu Racha!',
      message,
      {
        type: 'streak_celebration',
        habit_name: habitName,
        streak_days: streakDays,
        action_url: '/habits'
      }
    );
  }

  // Función para limpiar recursos cuando se cierra la app
  cleanup() {
    console.log('🧹 NotificationService: Limpiando recursos...');

    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }

    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }

    this.isInitialized = false;
  }

  // Función para obtener estado de permisos
  async getPermissionStatus() {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  // Función para solicitar permisos nuevamente si fueron denegados
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  }
}

// Exportamos una instancia singleton
export default new NotificationService();