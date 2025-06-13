import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import NotificationService from '../services/NotificationService';

// Creamos el contexto de autenticación que será el punto central de gestión de estado
const AuthContext = createContext({});

// Hook personalizado que simplifica el acceso al contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Componente proveedor que envuelve toda la aplicación y gestiona el estado de autenticación
export const AuthProvider = ({ children }) => {
  // Estado que almacena la información del usuario autenticado
  const [user, setUser] = useState(null);
  
  // Estado que indica si estamos verificando el estado de autenticación inicial
  const [loading, setLoading] = useState(true);
  
  // Estado que almacena la información extendida del perfil del usuario
  const [profile, setProfile] = useState(null);

  // Estado para el conteo de notificaciones no leídas
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

   const notificationsSubscriptionRef = useRef(null);

  // Función para obtener el perfil completo del usuario desde nuestra base de datos
  const fetchUserProfile = async (userId) => {
    try {
      // Consultamos la tabla profiles para obtener información extendida del usuario
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error al obtener perfil:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error inesperado al obtener perfil:', error);
      return null;
    }
  };

  // Función para cargar el conteo de notificaciones no leídas
  const loadUnreadNotificationsCount = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error cargando conteo de notificaciones:', error);
        return;
      }

      const count = data?.length || 0;
      setUnreadNotificationsCount(count);
      
      // Actualizamos el badge de la aplicación
      await NotificationService.setBadgeCount(count);

    } catch (error) {
      console.error('Error inesperado cargando notificaciones:', error);
    }
  };

  // Función para manejar cambios en el estado de autenticación
  const handleAuthStateChange = async (event, session) => {
    console.log('Cambio de estado de autenticación:', event, session?.user?.email);
    
    if (session?.user) {
      setUser(session.user);
      
      const userProfile = await fetchUserProfile(session.user.id);
      setProfile(userProfile);
      
      if (!userProfile) {
        console.warn('No se pudo obtener el perfil del usuario.');
      }

      console.log('🔔 AuthContext: Inicializando servicio de notificaciones...');
      await NotificationService.initialize(session.user.id);
      await loadUnreadNotificationsCount(session.user.id);

      // 🔧 IMPORTANTE: Solo configuramos suscripción después de limpiar
      setupNotificationsSubscription(session.user.id);

    } else {
      // 🔧 CLAVE: Limpiamos suscripción cuando no hay usuario
      if (notificationsSubscriptionRef.current) {
        console.log('🧹 AuthContext: Limpiando suscripción al cerrar sesión...');
        notificationsSubscriptionRef.current.unsubscribe();
        notificationsSubscriptionRef.current = null;
      }
      
      setUser(null);
      setProfile(null);
      setUnreadNotificationsCount(0);
      NotificationService.cleanup();
      await NotificationService.setBadgeCount(0);
    }
    
    setLoading(false);
  };


  // Función para configurar suscripción a notificaciones en tiempo real
   const setupNotificationsSubscription = (userId) => {
    console.log('🔔 AuthContext: Configurando suscripción a notificaciones...');

    // 🔧 CLAVE: Primero limpiamos cualquier suscripción existente
    if (notificationsSubscriptionRef.current) {
      console.log('🧹 AuthContext: Limpiando suscripción anterior...');
      notificationsSubscriptionRef.current.unsubscribe();
      notificationsSubscriptionRef.current = null;
    }

    // 🔧 IMPORTANTE: Creamos un nombre de canal único por usuario
    const channelName = `user_notifications_${userId}`;
    
    const notificationsSubscription = supabase
      .channel(channelName) // Canal único por usuario
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log('🔔 AuthContext: Nueva notificación recibida:', payload.new.title);
          
          setUnreadNotificationsCount(current => {
            const newCount = current + 1;
            NotificationService.setBadgeCount(newCount);
            return newCount;
          });

          if (payload.new.send_at && new Date(payload.new.send_at) > new Date()) {
            await NotificationService.scheduleLocalNotification(
              payload.new.title,
              payload.new.body,
              JSON.parse(payload.new.data || '{}'),
              payload.new.send_at
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          if (payload.new.is_read && !payload.old.is_read) {
            setUnreadNotificationsCount(current => {
              const newCount = Math.max(0, current - 1);
              NotificationService.setBadgeCount(newCount);
              return newCount;
            });
          }
        }
      )
      .subscribe();

    // 🔧 CLAVE: Guardamos la referencia para poder limpiarla después
    notificationsSubscriptionRef.current = notificationsSubscription;
    
    console.log('✅ AuthContext: Suscripción configurada correctamente');
    return notificationsSubscription;
  };

  // Efecto que configura el listener de cambios de autenticación cuando el componente se monta
// Efecto principal corregido
  useEffect(() => {
    console.log('Configurando listener de autenticación...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Sesión inicial:', session?.user?.email || 'No hay sesión');
      handleAuthStateChange('INITIAL_SESSION', session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // 🔧 CLAVE: Función de limpieza mejorada
    return () => {
      console.log('Removiendo listener de autenticación...');
      subscription?.unsubscribe();
      
      // Limpiamos suscripción de notificaciones
      if (notificationsSubscriptionRef.current) {
        console.log('🧹 AuthContext: Limpieza final de suscripciones...');
        notificationsSubscriptionRef.current.unsubscribe();
        notificationsSubscriptionRef.current = null;
      }
      
      NotificationService.cleanup();
    };
  }, []);

  // Función para cerrar sesión que limpia todo el estado relacionado con el usuario
  const signOut = async () => {
    try {
      console.log('Cerrando sesión...');

        if (notificationsSubscriptionRef.current) {
        notificationsSubscriptionRef.current.unsubscribe();
        notificationsSubscriptionRef.current = null;
      }
      
      // Limpiamos todas las notificaciones programadas
      await NotificationService.cancelAllScheduledNotifications();
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error al cerrar sesión:', error);
        return { error };
      }
      
      console.log('Sesión cerrada exitosamente');
      return { error: null };
    } catch (error) {
      console.error('Error inesperado al cerrar sesión:', error);
      return { error };
    }
  };

  // Función para refrescar los datos del perfil cuando sea necesario
  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchUserProfile(user.id);
      setProfile(updatedProfile);
      return updatedProfile;
    }
    return null;
  };

  // Función para actualizar el conteo de notificaciones no leídas
  const updateUnreadNotificationsCount = async () => {
    if (user) {
      await loadUnreadNotificationsCount(user.id);
    }
  };

  // Función para marcar todas las notificaciones como leídas
  const markAllNotificationsAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marcando todas las notificaciones como leídas:', error);
        return;
      }

      // Actualizamos el estado local
      setUnreadNotificationsCount(0);
      await NotificationService.setBadgeCount(0);
      
      console.log('✅ AuthContext: Todas las notificaciones marcadas como leídas');

    } catch (error) {
      console.error('Error inesperado marcando notificaciones como leídas:', error);
    }
  };

  // Función para programar recordatorios de hábitos basándose en las preferencias del usuario
  const scheduleHabitReminders = async () => {
    if (!user) return;

    try {
      console.log('📅 AuthContext: Programando recordatorios de hábitos...');

      // Primero cancelamos recordatorios existentes para evitar duplicados
      await NotificationService.cancelAllScheduledNotifications();

      // Obtenemos las preferencias del usuario
      const { data: preferences, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (prefsError || !preferences || !preferences.habit_reminders_enabled) {
        console.log('📅 AuthContext: Recordatorios de hábitos deshabilitados');
        return;
      }

      // Obtenemos los hábitos activos del usuario
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (habitsError || !habits || habits.length === 0) {
        console.log('📅 AuthContext: No hay hábitos activos para recordar');
        return;
      }

      // Programamos recordatorios para los próximos 7 días
      const today = new Date();
      const reminderDays = preferences.reminder_days || [1, 2, 3, 4, 5, 6, 7];
      const [reminderHour, reminderMinute] = (preferences.daily_reminder_time || '09:00:00').split(':').map(Number);

      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        
        const weekday = targetDate.getDay() || 7; // Convertimos domingo (0) a 7
        
        if (reminderDays.includes(weekday)) {
          targetDate.setHours(reminderHour, reminderMinute, 0, 0);
          
          // Solo programamos si la fecha está en el futuro
          if (targetDate > new Date()) {
            // Programamos un recordatorio por cada hábito (o uno general)
            const habitNames = habits.map(h => h.name).slice(0, 3); // Limitamos a 3 para no spam
            const habitsList = habitNames.length > 1 
              ? `${habitNames.slice(0, -1).join(', ')} y ${habitNames.slice(-1)}`
              : habitNames[0] || 'tus hábitos';

            await NotificationService.scheduleLocalNotification(
              '⏰ Recordatorio de Hábitos',
              `¡Es hora de trabajar en ${habitsList}! Mantén tu momentum activo.`,
              {
                type: 'habit_reminder',
                habits: habits.map(h => ({ id: h.id, name: h.name })),
                action_url: '/habits'
              },
              targetDate.toISOString()
            );
          }
        }
      }

      console.log('✅ AuthContext: Recordatorios programados exitosamente');

    } catch (error) {
      console.error('❌ AuthContext: Error programando recordatorios:', error);
    }
  };

  // Objeto que contiene todos los valores y funciones que queremos hacer disponibles
  const value = {
    user,                              // Información básica del usuario autenticado
    profile,                           // Información extendida del perfil del usuario
    loading,                           // Indicador de si estamos verificando el estado inicial
    unreadNotificationsCount,          // Conteo de notificaciones no leídas
    signOut,                           // Función para cerrar sesión
    refreshProfile,                    // Función para refrescar datos del perfil
    updateUnreadNotificationsCount,    // Función para actualizar conteo de notificaciones
    markAllNotificationsAsRead,        // Función para marcar todas como leídas
    scheduleHabitReminders,            // Función para programar recordatorios
  };

  // Proporcionamos el contexto a todos los componentes hijos
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};