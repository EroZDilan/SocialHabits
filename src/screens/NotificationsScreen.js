import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  Alert
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationsScreen() {
  // Accedemos al usuario autenticado
  const { user } = useAuth();
  
  // Estados para manejar notificaciones
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Función para cargar notificaciones del usuario
  const loadNotifications = async () => {
    if (!user) return;

    try {
      console.log('🔔 Cargando notificaciones para usuario:', user.email);

      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limitamos para rendimiento

      if (error) {
        console.error('Error cargando notificaciones:', error);
        return;
      }

      console.log(`🔔 Cargadas ${notificationsData?.length || 0} notificaciones`);
      
      const processedNotifications = (notificationsData || []).map(notification => ({
        ...notification,
        // Procesamos la data JSON para facilitar el acceso
        parsedData: typeof notification.data === 'string' 
          ? JSON.parse(notification.data) 
          : notification.data
      }));

      setNotifications(processedNotifications);
      
      // Contamos notificaciones no leídas
      const unread = processedNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);

    } catch (error) {
      console.error('Error inesperado cargando notificaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Función para marcar una notificación como leída
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marcando notificación como leída:', error);
        return;
      }

      // Actualizamos el estado local
      setNotifications(current => 
        current.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true, read_at: new Date().toISOString() }
            : notification
        )
      );

      // Actualizamos contador de no leídas
      setUnreadCount(current => Math.max(0, current - 1));

    } catch (error) {
      console.error('Error inesperado marcando como leída:', error);
    }
  };

  // Función para marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      
      if (unreadNotifications.length === 0) {
        Alert.alert('Info', 'No tienes notificaciones sin leer.');
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marcando todas como leídas:', error);
        Alert.alert('Error', 'No se pudieron marcar todas las notificaciones como leídas.');
        return;
      }

      // Actualizamos estado local
      setNotifications(current => 
        current.map(notification => ({
          ...notification,
          is_read: true,
          read_at: new Date().toISOString()
        }))
      );

      setUnreadCount(0);

      console.log('✅ Todas las notificaciones marcadas como leídas');

    } catch (error) {
      console.error('Error inesperado marcando todas como leídas:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado.');
    }
  };

  // Función para manejar tap en notificación
  const handleNotificationTap = async (notification) => {
    console.log('🔔 Notificación seleccionada:', notification.type);

    // Marcamos como leída si no lo está
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Aquí podrías navegar a la pantalla específica según el tipo
    // Por ejemplo, usando React Navigation:
    // navigation.navigate('Habits', { habitId: notification.parsedData.habit_id });
    
    // Por ahora mostramos la información en un alert
    showNotificationDetails(notification);
  };

  // Función para mostrar detalles de la notificación
  const showNotificationDetails = (notification) => {
    let detailMessage = notification.body;
    
    if (notification.parsedData) {
      switch (notification.type) {
        case 'habit_completion':
          detailMessage += `\n\nHábito: ${notification.parsedData.habit_name}`;
          if (notification.parsedData.group_name) {
            detailMessage += `\nGrupo: ${notification.parsedData.group_name}`;
          }
          break;
        case 'list_activity':
          detailMessage += `\n\nLista: ${notification.parsedData.list_name}`;
          detailMessage += `\nElemento: ${notification.parsedData.item_content}`;
          break;
        case 'group_invitation':
          detailMessage += `\n\nGrupo: ${notification.parsedData.group_name}`;
          break;
      }
    }

    Alert.alert(notification.title, detailMessage, [
      { text: 'OK', style: 'default' }
    ]);
  };

  // Función para obtener icono según tipo de notificación
  const getNotificationIcon = (type) => {
    const icons = {
      'habit_reminder': '⏰',
      'habit_completion': '🎯',
      'group_achievement': '🏆',
      'group_invitation': '📧',
      'list_activity': '📝',
      'streak_celebration': '🔥',
      'group_streak_celebration': '🎉',
      'welcome': '👋',
      'system_update': '🔔'
    };
    return icons[type] || '📢';
  };

  // Función para obtener color según tipo
  const getNotificationColor = (type) => {
    const colors = {
      'habit_reminder': '#f39c12',
      'habit_completion': '#27ae60',
      'group_achievement': '#e74c3c',
      'group_invitation': '#3498db',
      'list_activity': '#9b59b6',
      'streak_celebration': '#e67e22',
      'group_streak_celebration': '#e74c3c',
      'welcome': '#2ecc71',
      'system_update': '#34495e'
    };
    return colors[type] || '#7f8c8d';
  };

  // Función para formatear tiempo relativo
  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString();
  };

  // Función para obtener URL del avatar
  const getAvatarUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(imageUrl);
    
    return data.publicUrl;
  };

  // Función para manejar pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  // Función para limpiar notificaciones antiguas
  const clearOldNotifications = async () => {
    Alert.alert(
      'Limpiar Notificaciones',
      '¿Quieres eliminar las notificaciones leídas de hace más de una semana?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Limpiar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const oneWeekAgo = new Date();
              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id)
                .eq('is_read', true)
                .lt('created_at', oneWeekAgo.toISOString());

              if (error) {
                Alert.alert('Error', 'No se pudieron limpiar las notificaciones.');
                return;
              }

              await loadNotifications();
              Alert.alert('Limpieza Completa', 'Notificaciones antiguas eliminadas.');

            } catch (error) {
              Alert.alert('Error', 'Ocurrió un error inesperado.');
            }
          }
        }
      ]
    );
  };

  // Efecto para cargar notificaciones cuando el componente se monta
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  // Configuramos suscripción en tiempo real para nuevas notificaciones
  useEffect(() => {
    if (!user) return;

    const notificationsSubscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Nueva notificación recibida:', payload.new);
          
          const newNotification = {
            ...payload.new,
            parsedData: typeof payload.new.data === 'string' 
              ? JSON.parse(payload.new.data) 
              : payload.new.data
          };

          setNotifications(current => [newNotification, ...current]);
          setUnreadCount(current => current + 1);
        }
      )
      .subscribe();

    return () => {
      notificationsSubscription.unsubscribe();
    };
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando notificaciones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con controles */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notificaciones</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Text style={styles.markAllButtonText}>Marcar todas</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.clearButton} onPress={clearOldNotifications}>
            <Text style={styles.clearButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de notificaciones */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🔔</Text>
            <Text style={styles.emptyStateTitle}>No hay notificaciones</Text>
            <Text style={styles.emptyStateDescription}>
              Cuando tengas actividad en tus hábitos y grupos, las notificaciones aparecerán aquí.
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.is_read && styles.unreadNotificationCard
              ]}
              onPress={() => handleNotificationTap(notification)}
              activeOpacity={0.7}
            >
              {/* Indicador de no leída */}
              {!notification.is_read && <View style={styles.unreadIndicator} />}

              <View style={styles.notificationContent}>
                {/* Avatar o icono */}
                <View style={styles.notificationIconContainer}>
                  {notification.image_url ? (
                    <Image
                      source={{ uri: getAvatarUrl(notification.image_url) }}
                      style={styles.notificationAvatar}
                      onError={() => console.log('Error cargando avatar de notificación')}
                    />
                  ) : (
                    <View style={[
                      styles.notificationIcon,
                      { backgroundColor: getNotificationColor(notification.type) }
                    ]}>
                      <Text style={styles.notificationIconText}>
                        {getNotificationIcon(notification.type)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Contenido del mensaje */}
                <View style={styles.notificationText}>
                  <Text style={[
                    styles.notificationTitle,
                    !notification.is_read && styles.unreadNotificationTitle
                  ]}>
                    {notification.title}
                  </Text>
                  
                  <Text style={styles.notificationBody} numberOfLines={3}>
                    {notification.body}
                  </Text>
                  
                  <Text style={styles.notificationTime}>
                    {getRelativeTime(notification.created_at)}
                  </Text>
                </View>

                {/* Indicador de tipo */}
                <View style={styles.notificationMeta}>
                  <View style={[
                    styles.typeIndicator,
                    { backgroundColor: getNotificationColor(notification.type) }
                  ]}>
                    <Text style={styles.typeIndicatorText}>
                      {getNotificationIcon(notification.type)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Información sobre configuraciones */}
        {notifications.length > 0 && (
          <View style={styles.settingsInfo}>
            <Text style={styles.settingsInfoTitle}>⚙️ Configurar Notificaciones</Text>
            <Text style={styles.settingsInfoText}>
              Puedes personalizar qué notificaciones recibir y cuándo en la configuración de tu perfil.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
  loadingText: {
    fontSize: 18,
    color: '#3498db',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  unreadBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markAllButton: {
    backgroundColor: '#3498db',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  markAllButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  unreadNotificationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    backgroundColor: '#f8fafe',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
    zIndex: 1,
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  notificationIconContainer: {
    marginRight: 12,
  },
  notificationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIconText: {
    fontSize: 20,
    color: '#ffffff',
  },
  notificationText: {
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
    lineHeight: 20,
  },
  unreadNotificationTitle: {
    color: '#1a252f',
    fontWeight: 'bold',
  },
  notificationBody: {
    fontSize: 14,
    color: '#5a6c7d',
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#95a5a6',
  },
  notificationMeta: {
    alignItems: 'center',
  },
  typeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIndicatorText: {
    fontSize: 10,
    color: '#ffffff',
  },
  settingsInfo: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  settingsInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 8,
  },
  settingsInfoText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
  },
});