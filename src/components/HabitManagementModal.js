import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function HabitManagementModal({ 
  visible, 
  onClose, 
  onSave, 
  editingHabit = null 
}) {
  // Accedemos al usuario autenticado para asociar hábitos correctamente
  const { user } = useAuth();
  
  // Estados para todos los campos del formulario de hábito
  // Estos estados representan todas las propiedades configurables de un hábito
  const [habitName, setHabitName] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [allowRestDays, setAllowRestDays] = useState(false);
  const [restDaysPerWeek, setRestDaysPerWeek] = useState(0);

// Nuevos estados para funcionalidad de grupos - AÑADIR AQUÍ
const [userGroups, setUserGroups] = useState([]);
const [selectedGroupId, setSelectedGroupId] = useState(null);
const [isShared, setIsShared] = useState(false);
const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Estados para manejar la validación y el procesamiento
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  // Determinamos si estamos en modo de edición o creación
  // Esta lógica nos permite usar el mismo componente para ambos casos
  const isEditing = editingHabit !== null;
  const modalTitle = isEditing ? 'Editar Hábito' : 'Crear Nuevo Hábito';
  const saveButtonText = isEditing ? 'Guardar Cambios' : 'Crear Hábito';

  // Efecto que inicializa el formulario cuando cambia el hábito en edición
  // Esto maneja tanto la apertura en modo crear (editingHabit = null) como en modo editar
useEffect(() => {
  if (visible) {
    // Cargamos los grupos de administrador cuando el modal se abre
    loadUserAdminGroups();
    
    if (isEditing && editingHabit) {
      // Si estamos editando, prellenamos el formulario con los datos existentes
      setHabitName(editingHabit.name || '');
      setHabitDescription(editingHabit.description || '');
      setAllowRestDays(editingHabit.allow_rest_days || false);
      setRestDaysPerWeek(editingHabit.rest_days_per_week || 0);
      
      // Configuramos los estados de compartir si el hábito está compartido
      if (editingHabit.group_id) {
        setIsShared(true);
        setSelectedGroupId(editingHabit.group_id);
      } else {
        setIsShared(false);
        setSelectedGroupId(null);
      }
      
      console.log('HabitModal: Inicializado para edición:', editingHabit.name);
    } else {
      // Si estamos creando, limpiamos todos los campos
      resetForm();
      console.log('HabitModal: Inicializado para creación');
    }
  }
}, [editingHabit, visible]);
  // Función para limpiar completamente el formulario
  const resetForm = () => {
  setHabitName('');
  setHabitDescription('');
  setAllowRestDays(false);
  setRestDaysPerWeek(0);
  // AÑADIR ESTAS DOS LÍNEAS AQUÍ
  setIsShared(false);
  setSelectedGroupId(null);
  setNameError('');
  setDescriptionError('');
};

// Función para cargar grupos donde el usuario es administrador - AÑADIR AQUÍ
const loadUserAdminGroups = async () => {
  if (!user) return;

  setLoadingGroups(true);
  try {
    console.log('HabitModal: Cargando grupos donde el usuario es administrador...');
    
    const { data: adminGroups, error } = await supabase
      .from('group_members')
      .select(`
        groups (
          id,
          name,
          description
        )
      `)
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (error) {
      console.error('HabitModal: Error al cargar grupos de administrador:', error);
      return;
    }

    const groups = adminGroups?.map(membership => membership.groups) || [];
    setUserGroups(groups);
    console.log('HabitModal: Grupos de administrador cargados:', groups.length);

  } catch (error) {
    console.error('HabitModal: Error inesperado al cargar grupos:', error);
  } finally {
    setLoadingGroups(false);
  }
};


  // Función de validación que verifica la integridad de los datos del formulario
  // Esta función implementa validación tanto de formato como de lógica de negocio
  const validateForm = () => {
    let isValid = true;
    
    // Validación del nombre: debe estar presente y tener longitud apropiada
    if (!habitName.trim()) {
      setNameError('El nombre del hábito es requerido');
      isValid = false;
    } else if (habitName.trim().length < 3) {
      setNameError('El nombre debe tener al menos 3 caracteres');
      isValid = false;
    } else if (habitName.trim().length > 50) {
      setNameError('El nombre no puede exceder 50 caracteres');
      isValid = false;
    } else {
      setNameError('');
    }

    // Validación de la descripción: opcional pero con límites si se proporciona
    if (habitDescription.trim().length > 200) {
      setDescriptionError('La descripción no puede exceder 200 caracteres');
      isValid = false;
    } else {
      setDescriptionError('');
    }

    // Validación de lógica de días de descanso
    // Si permite días de descanso, debe especificar un número válido
    if (allowRestDays && (restDaysPerWeek < 1 || restDaysPerWeek > 6)) {
      Alert.alert(
        'Configuración Inválida',
        'Si permites días de descanso, debe ser entre 1 y 6 días por semana.'
      );
      isValid = false;
    }

    return isValid;
  };

  // Función principal que maneja el guardado del hábito
  // Esta función coordina validación, operación de base de datos, y actualización de UI
  const handleSave = async () => {
    console.log('Modal: Iniciando guardado de hábito...');
    
    // Validamos el formulario antes de proceder
    if (!validateForm()) {
      console.log('Modal: Validación falló, abortando guardado');
      return;
    }

    setSaving(true);

    try {
      // Preparamos los datos del hábito para enviar a la base de datos
const habitData = {
  name: habitName.trim(),
  description: habitDescription.trim() || null,
  allow_rest_days: allowRestDays,
  rest_days_per_week: allowRestDays ? restDaysPerWeek : 0,
  user_id: user.id,
  group_id: isShared ? selectedGroupId : null, // AÑADIR ESTA LÍNEA
  is_active: true
};
      console.log('Modal: Datos preparados:', habitData);

      let result;
      if (isEditing) {
        // Actualizamos el hábito existente
        console.log('Modal: Actualizando hábito existente:', editingHabit.id);
        result = await supabase
          .from('habits')
          .update(habitData)
          .eq('id', editingHabit.id)
          .eq('user_id', user.id) // Verificación adicional de seguridad
          .select()
          .single();
      } else {
        // Creamos un nuevo hábito
        console.log('Modal: Creando nuevo hábito');
        result = await supabase
          .from('habits')
          .insert(habitData)
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) {
        console.error('Modal: Error en operación de base de datos:', error);
        
        // Manejamos errores específicos con mensajes amigables para el usuario
        if (error.code === '23505') { // Violación de constraint único
          Alert.alert('Nombre Duplicado', 'Ya tienes un hábito con ese nombre. Elige un nombre diferente.');
        } else {
          Alert.alert('Error', `No se pudo ${isEditing ? 'actualizar' : 'crear'} el hábito. Intenta nuevamente.`);
        }
        return;
      }

      console.log('Modal: Operación exitosa:', data);

      // Notificamos al componente padre sobre el éxito para que actualice la lista
      if (onSave) {
        onSave(data);
      }

      // Cerramos el modal y limpiamos el formulario
      onClose();
      resetForm();

      // Mostramos confirmación al usuario
      Alert.alert(
        'Éxito',
        `Hábito ${isEditing ? 'actualizado' : 'creado'} correctamente.`,
        [{ text: 'Genial!', style: 'default' }]
      );

    } catch (error) {
      console.error('Modal: Error inesperado:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // Función que maneja el cierre del modal con confirmación si hay cambios no guardados
  const handleClose = () => {
    // Verificamos si hay cambios no guardados que podrían perderse
    const hasChanges = habitName.trim() !== '' || 
                      habitDescription.trim() !== '' || 
                      allowRestDays !== false || 
                      restDaysPerWeek !== 0;

    if (hasChanges && !isEditing) {
      // Si hay cambios en un hábito nuevo, pedimos confirmación
      Alert.alert(
        'Descartar Cambios',
        '¿Estás seguro de que quieres cerrar? Se perderán los cambios no guardados.',
        [
          { text: 'Continuar Editando', style: 'cancel' },
          { 
            text: 'Descartar', 
            style: 'destructive',
            onPress: () => {
              resetForm();
              onClose();
            }
          }
        ]
      );
    } else {
      // Si no hay cambios o estamos editando, cerramos directamente
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header del modal con título y botón de cerrar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>{modalTitle}</Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Guardando...' : saveButtonText}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Campo de nombre del hábito */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Nombre del Hábito *</Text>
            <TextInput
              style={[styles.textInput, nameError ? styles.inputError : null]}
              value={habitName}
              onChangeText={setHabitName}
              placeholder="ej. Leer 30 minutos, Hacer ejercicio, Meditar..."
              maxLength={50}
              autoCapitalize="sentences"
              autoCorrect={true}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            <Text style={styles.helperText}>
              Dale un nombre claro y específico a tu hábito
            </Text>
          </View>

          {/* Campo de descripción opcional */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Descripción (Opcional)</Text>
            <TextInput
              style={[
                styles.textInput, 
                styles.textArea, 
                descriptionError ? styles.inputError : null
              ]}
              value={habitDescription}
              onChangeText={setHabitDescription}
              placeholder="Añade detalles sobre tu hábito, metas específicas, o por qué es importante para ti..."
              maxLength={200}
              multiline={true}
              numberOfLines={3}
              autoCapitalize="sentences"
              autoCorrect={true}
            />
            {descriptionError ? <Text style={styles.errorText}>{descriptionError}</Text> : null}
            <Text style={styles.helperText}>
              Una descripción te ayudará a recordar por qué este hábito es importante
            </Text>
          </View>

          {/* Configuración de días de descanso */}
          <View style={styles.fieldContainer}>
            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.fieldLabel}>Permitir Días de Descanso</Text>
                <Text style={styles.switchDescription}>
                  Para hábitos físicos que requieren recuperación
                </Text>
              </View>
              <Switch
                value={allowRestDays}
                onValueChange={setAllowRestDays}
                trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                thumbColor={allowRestDays ? '#ffffff' : '#f4f3f4'}
              />
            </View>
            
            {allowRestDays && (
              <View style={styles.restDaysConfig}>
                <Text style={styles.fieldLabel}>Días de descanso por semana</Text>
                <View style={styles.restDaysButtons}>
                  {[1, 2, 3, 4, 5, 6].map(days => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.restDayButton,
                        restDaysPerWeek === days ? styles.restDayButtonActive : null
                      ]}
                      onPress={() => setRestDaysPerWeek(days)}
                    >
                      <Text style={[
                        styles.restDayButtonText,
                        restDaysPerWeek === days ? styles.restDayButtonTextActive : null
                      ]}>
                        {days}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.helperText}>
                  Los días de descanso mantendrán tu racha activa
                </Text>
              </View>
            )}
          </View>

          {/* Configuración de compartir con grupos - solo si el usuario tiene grupos donde es admin */}
{userGroups.length > 0 && (
  <View style={styles.fieldContainer}>
    <View style={styles.switchContainer}>
      <View style={styles.switchLabelContainer}>
        <Text style={styles.fieldLabel}>Compartir con Grupo</Text>
        <Text style={styles.switchDescription}>
          Los hábitos compartidos son visibles para todos los miembros del grupo
        </Text>
      </View>
      <Switch
        value={isShared}
        onValueChange={(value) => {
          setIsShared(value);
          if (!value) setSelectedGroupId(null);
        }}
        trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
        thumbColor={isShared ? '#ffffff' : '#f4f3f4'}
      />
    </View>
    
    {isShared && (
      <View style={styles.groupSelectionContainer}>
        <Text style={styles.fieldLabel}>Seleccionar Grupo</Text>
        {loadingGroups ? (
          <Text style={styles.loadingText}>Cargando grupos...</Text>
        ) : (
          <ScrollView style={styles.groupsList} showsVerticalScrollIndicator={false}>
            {userGroups.map(group => (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.groupOption,
                  selectedGroupId === group.id ? styles.groupOptionSelected : null
                ]}
                onPress={() => setSelectedGroupId(group.id)}
              >
                <View style={styles.groupOptionContent}>
                  <Text style={[
                    styles.groupOptionName,
                    selectedGroupId === group.id ? styles.groupOptionNameSelected : null
                  ]}>
                    {group.name}
                  </Text>
                  {group.description && (
                    <Text style={[
                      styles.groupOptionDescription,
                      selectedGroupId === group.id ? styles.groupOptionDescriptionSelected : null
                    ]}>
                      {group.description}
                    </Text>
                  )}
                </View>
                {selectedGroupId === group.id && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <Text style={styles.helperText}>
          Solo puedes compartir hábitos con grupos donde eres administrador
        </Text>
      </View>
    )}
  </View>
)}

          {/* Información adicional y consejos */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 Consejos para crear hábitos exitosos:</Text>
            <Text style={styles.tipText}>• Sé específico: "Leer 20 páginas" vs "Leer más"</Text>
            <Text style={styles.tipText}>• Empieza pequeño: es mejor 5 minutos diarios que 1 hora semanal</Text>
            <Text style={styles.tipText}>• Vincúlalo a un hábito existente: "Después de desayunar, haré..."</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fieldContainer: {
    marginTop: 25,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#2c3e50',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 5,
  },
  helperText: {
    color: '#7f8c8d',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 15,
  },
  switchDescription: {
    color: '#7f8c8d',
    fontSize: 12,
    marginTop: 2,
  },
  restDaysConfig: {
    marginTop: 15,
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  restDaysButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  restDayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  restDayButtonActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  restDayButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  restDayButtonTextActive: {
    color: '#ffffff',
  },
  tipsContainer: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 12,
    color: '#2d5a3d',
    marginBottom: 5,
    lineHeight: 16,
  },
   // Añadir estos estilos al objeto styles existente
groupSelectionContainer: {
  marginTop: 15,
  backgroundColor: '#ffffff',
  padding: 15,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#e0e0e0',
},
groupsList: {
  maxHeight: 150,
  marginTop: 10,
  marginBottom: 10,
},
groupOption: {
  backgroundColor: '#f8f9fa',
  padding: 12,
  borderRadius: 8,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: '#e0e0e0',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
groupOptionSelected: {
  backgroundColor: '#e8f5e8',
  borderColor: '#27ae60',
},
groupOptionContent: {
  flex: 1,
},
groupOptionName: {
  fontSize: 14,
  fontWeight: '600',
  color: '#2c3e50',
},
groupOptionNameSelected: {
  color: '#27ae60',
},
groupOptionDescription: {
  fontSize: 12,
  color: '#7f8c8d',
  marginTop: 2,
},
groupOptionDescriptionSelected: {
  color: '#2d5a3d',
},
selectedIndicator: {
  fontSize: 16,
  color: '#27ae60',
  fontWeight: 'bold',
},
loadingText: {
  fontSize: 14,
  color: '#7f8c8d',
  textAlign: 'center',
  marginVertical: 10,
},
});