import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationSettingsModal({ visible, onClose, onSave }) {
  // Accedemos al usuario autenticado
  const { user } = useAuth();
  
  // Estados para todas las configuraciones de notificaciones
  const [preferences, setPreferences] = useState({
    // Recordatorios de hábitos
    habit_reminders_enabled: true,
    daily_reminder_time: new Date(new Date().setHours(9, 0, 0, 0)), // 9:00 AM por defecto
    reminder_days: [1, 2, 3, 4, 5, 6, 7], // Todos los días por defecto
    
    // Notificaciones sociales
    group_activity_enabled: true,
    group_achievements_enabled: true,
    group_invitations_enabled: true,
    
    // Celebraciones
    personal_celebrations_enabled: true,
    group_celebrations_enabled: true,
    
    // Listas colaborativas
    list_activity_enabled: true,
    list_completion_enabled: true,
    
    // Configuraciones técnicas
    timezone: 'UTC',
    quiet_hours_start: new Date(new Date().setHours(22, 0, 0, 0)), // 10:00 PM
    quiet_hours_end: new Date(new Date().setHours(7, 0, 0, 0)), // 7:00 AM
  });
  
  // Estados para control de la interfaz
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(null);

  // Nombres de los días de la semana
  const weekDays = [
    { id: 1, name: 'Lunes', short: 'L' },
    { id: 2, name: 'Martes', short: 'M' },
    { id: 3, name: 'Miércoles', short: 'X' },
    { id: 4, name: 'Jueves', short: 'J' },
    { id: 5, name: 'Viernes', short: 'V' },
    { id: 6, name: 'Sábado', short: 'S' },
    { id: 7, name: 'Domingo', short: 'D' }
  ];

  // Función para cargar preferencias existentes
  const loadPreferences = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('⚙️ Cargando preferencias de notificaciones para:', user.email);

      const { data: prefs, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando preferencias:', error);
        return;
      }

      if (prefs) {
        console.log('⚙️ Preferencias cargadas:', prefs);
        
        // Convertimos los strings de tiempo a objetos Date para los pickers
        const reminderTime = prefs.daily_reminder_time 
          ? new Date(`2000-01-01T${prefs.daily_reminder_time}`) 
          : new Date(new Date().setHours(9, 0, 0, 0));
          
        const quietStart = prefs.quiet_hours_start 
          ? new Date(`2000-01-01T${prefs.quiet_hours_start}`) 
          : new Date(new Date().setHours(22, 0, 0, 0));
          
        const quietEnd = prefs.quiet_hours_end 
          ? new Date(`2000-01-01T${prefs.quiet_hours_end}`) 
          : new Date(new Date().setHours(7, 0, 0, 0));

        setPreferences({
          ...prefs,
          daily_reminder_time: reminderTime,
          quiet_hours_start: quietStart,
          quiet_hours_end: quietEnd,
          reminder_days: prefs.reminder_days || [1, 2, 3, 4, 5, 6, 7]
        });
      } else {
        console.log('⚙️ No hay preferencias existentes, usando valores por defecto');
      }

    } catch (error) {
      console.error('Error inesperado cargando preferencias:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para guardar preferencias
  const savePreferences = async () => {
    console.log('💾 Guardando preferencias de notificaciones...');
    setSaving(true);

    try {
      // Convertimos las fechas de vuelta a strings de tiempo
      const prefsToSave = {
        ...preferences,
        user_id: user.id,
        daily_reminder_time: formatTimeForDB(preferences.daily_reminder_time),
        quiet_hours_start: formatTimeForDB(preferences.quiet_hours_start),
        quiet_hours_end: formatTimeForDB(preferences.quiet_hours_end),
        updated_at: new Date().toISOString()
      };

      // Removemos las fechas que no van a la BD
      delete prefsToSave.daily_reminder_time_obj;
      delete prefsToSave.quiet_hours_start_obj;
      delete prefsToSave.quiet_hours_end_obj;

      console.log('📤 Guardando preferencias:', prefsToSave);

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(prefsToSave, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error guardando preferencias:', error);
        Alert.alert('Error', 'No se pudieron guardar las preferencias. Intenta nuevamente.');
        return;
      }

      console.log('✅ Preferencias guardadas exitosamente');

      // Notificamos al componente padre
      if (onSave) {
        await onSave();
      }

      // Cerramos el modal
      onClose();

      Alert.alert(
        'Preferencias Guardadas',
        'Tus configuraciones de notificaciones se han actualizado correctamente.',
        [{ text: 'Perfecto', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado guardando preferencias:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // Función auxiliar para formatear tiempo para la base de datos
  const formatTimeForDB = (date) => {
    return date.toTimeString().slice(0, 8); // HH:MM:SS
  };

  // Función para formatear tiempo para mostrar
  const formatTimeForDisplay = (date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Función para alternar un día de recordatorio
  const toggleReminderDay = (dayId) => {
    setPreferences(prev => ({
      ...prev,
      reminder_days: prev.reminder_days.includes(dayId)
        ? prev.reminder_days.filter(id => id !== dayId)
        : [...prev.reminder_days, dayId].sort()
    }));
  };

  // Función para alternar configuración booleana
  const togglePreference = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Función para manejar cambio de tiempo
  const handleTimeChange = (event, selectedDate, timeType) => {
    setShowTimePicker(null);
    
    if (selectedDate) {
      setPreferences(prev => ({
        ...prev,
        [timeType]: selectedDate
      }));
    }
  };

  // Función para manejar cierre del modal
  const handleClose = () => {
    Alert.alert(
      'Descartar Cambios',
      '¿Estás seguro de que quieres cerrar sin guardar?',
      [
        { text: 'Continuar Editando', style: 'cancel' },
        { 
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            loadPreferences(); // Recargamos las preferencias originales
            onClose();
          }
        }
      ]
    );
  };

  // Efecto para cargar preferencias cuando se abre el modal
  useEffect(() => {
    if (visible) {
      loadPreferences();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header del modal */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Configurar Notificaciones</Text>
          
          <TouchableOpacity 
            onPress={savePreferences} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando configuraciones...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Sección de recordatorios de hábitos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏰ Recordatorios de Hábitos</Text>
              <Text style={styles.sectionDescription}>
                Configuraciones para recordatorios diarios de tus hábitos pendientes
              </Text>
              
              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Habilitar Recordatorios</Text>
                  <Text style={styles.switchDescription}>
                    Recibir recordatorios sobre hábitos no completados
                  </Text>
                </View>
                <Switch
                  value={preferences.habit_reminders_enabled}
                  onValueChange={() => togglePreference('habit_reminders_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#f39c12' }}
                  thumbColor={preferences.habit_reminders_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              {preferences.habit_reminders_enabled && (
                <>
                  {/* Configuración de hora de recordatorio */}
                  <View style={styles.timePickerContainer}>
                    <Text style={styles.fieldLabel}>Hora de Recordatorio</Text>
                    <TouchableOpacity 
                      style={styles.timePickerButton}
                      onPress={() => setShowTimePicker('daily_reminder_time')}
                    >
                      <Text style={styles.timePickerButtonText}>
                        {formatTimeForDisplay(preferences.daily_reminder_time)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Días de la semana */}
                  <View style={styles.daysContainer}>
                    <Text style={styles.fieldLabel}>Días de Recordatorio</Text>
                    <View style={styles.daysGrid}>
                      {weekDays.map(day => (
                        <TouchableOpacity
                          key={day.id}
                          style={[
                            styles.dayButton,
                            preferences.reminder_days.includes(day.id) && styles.dayButtonActive
                          ]}
                          onPress={() => toggleReminderDay(day.id)}
                        >
                          <Text style={[
                            styles.dayButtonText,
                            preferences.reminder_days.includes(day.id) && styles.dayButtonTextActive
                          ]}>
                            {day.short}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Sección de notificaciones sociales */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👥 Actividad Social</Text>
              <Text style={styles.sectionDescription}>
                Notificaciones sobre actividad en tus grupos y hábitos compartidos
              </Text>
              
              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Actividad de Grupo</Text>
                  <Text style={styles.switchDescription}>
                    Cuando miembros completan hábitos compartidos
                  </Text>
                </View>
                <Switch
                  value={preferences.group_activity_enabled}
                  onValueChange={() => togglePreference('group_activity_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                  thumbColor={preferences.group_activity_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Logros de Grupo</Text>
                  <Text style={styles.switchDescription}>
                    Cuando el grupo alcanza hitos importantes
                  </Text>
                </View>
                <Switch
                  value={preferences.group_achievements_enabled}
                  onValueChange={() => togglePreference('group_achievements_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                  thumbColor={preferences.group_achievements_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Invitaciones a Grupos</Text>
                  <Text style={styles.switchDescription}>
                    Cuando te invitan a unirte a nuevos grupos
                  </Text>
                </View>
                <Switch
                  value={preferences.group_invitations_enabled}
                  onValueChange={() => togglePreference('group_invitations_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                  thumbColor={preferences.group_invitations_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Sección de celebraciones */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎉 Celebraciones</Text>
              <Text style={styles.sectionDescription}>
                Notificaciones para celebrar logros y rachas importantes
              </Text>
              
              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Celebraciones Personales</Text>
                  <Text style={styles.switchDescription}>
                    Tus propias rachas y logros importantes
                  </Text>
                </View>
                <Switch
                  value={preferences.personal_celebrations_enabled}
                  onValueChange={() => togglePreference('personal_celebrations_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#e74c3c' }}
                  thumbColor={preferences.personal_celebrations_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Celebraciones Grupales</Text>
                  <Text style={styles.switchDescription}>
                    Logros y rachas de miembros de tus grupos
                  </Text>
                </View>
                <Switch
                  value={preferences.group_celebrations_enabled}
                  onValueChange={() => togglePreference('group_celebrations_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#e74c3c' }}
                  thumbColor={preferences.group_celebrations_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Sección de listas colaborativas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 Listas Colaborativas</Text>
              <Text style={styles.sectionDescription}>
                Notificaciones sobre actividad en listas compartidas
              </Text>
              
              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Actividad en Listas</Text>
                  <Text style={styles.switchDescription}>
                    Cuando se añaden nuevos elementos
                  </Text>
                </View>
                <Switch
                  value={preferences.list_activity_enabled}
                  onValueChange={() => togglePreference('list_activity_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#9b59b6' }}
                  thumbColor={preferences.list_activity_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Elementos Completados</Text>
                  <Text style={styles.switchDescription}>
                    Cuando se marcan elementos como completados
                  </Text>
                </View>
                <Switch
                  value={preferences.list_completion_enabled}
                  onValueChange={() => togglePreference('list_completion_enabled')}
                  trackColor={{ false: '#e0e0e0', true: '#9b59b6' }}
                  thumbColor={preferences.list_completion_enabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Sección de horas silenciosas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🌙 Horas Silenciosas</Text>
              <Text style={styles.sectionDescription}>
                Período en el que no recibirás notificaciones (excepto urgentes)
              </Text>
              
              <View style={styles.timeRangeContainer}>
                <View style={styles.timePickerContainer}>
                  <Text style={styles.fieldLabel}>Inicio</Text>
                  <TouchableOpacity 
                    style={styles.timePickerButton}
                    onPress={() => setShowTimePicker('quiet_hours_start')}
                  >
                    <Text style={styles.timePickerButtonText}>
                      {formatTimeForDisplay(preferences.quiet_hours_start)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.timePickerContainer}>
                  <Text style={styles.fieldLabel}>Fin</Text>
                  <TouchableOpacity 
                    style={styles.timePickerButton}
                    onPress={() => setShowTimePicker('quiet_hours_end')}
                  >
                    <Text style={styles.timePickerButtonText}>
                      {formatTimeForDisplay(preferences.quiet_hours_end)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Información adicional */}
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>💡 Sobre las Notificaciones</Text>
              <Text style={styles.infoText}>
                • Los recordatorios de hábitos solo se envían para hábitos no completados ese día
              </Text>
              <Text style={styles.infoText}>
                • Las notificaciones sociales te mantienen conectado con tu comunidad
              </Text>
              <Text style={styles.infoText}>
                • Puedes cambiar estas configuraciones en cualquier momento
              </Text>
              <Text style={styles.infoText}>
                • Las horas silenciosas se respetan para notificaciones no urgentes
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={preferences[showTimePicker]}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => 
              handleTimeChange(event, selectedDate, showTimePicker)
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  closeButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#3498db',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 18,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 15,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    lineHeight: 16,
  },
  timePickerContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  timePickerButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  timePickerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  daysContainer: {
    marginBottom: 20,
  },
  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#f39c12',
    borderColor: '#f39c12',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  dayButtonTextActive: {
    color: '#ffffff',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  infoSection: {
    backgroundColor: '#e8f4fd',
    borderRadius: 16,
    padding: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
    marginBottom: 5,
  },
});