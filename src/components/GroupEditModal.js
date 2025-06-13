import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function GroupEditModal({ 
  visible, 
  onClose, 
  group, 
  onGroupUpdated 
}) {
  const { user } = useAuth();
  
  // Estados para los campos del formulario
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Estados para validación
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  // Función para inicializar el formulario con datos del grupo
  const initializeForm = () => {
    if (group) {
      setGroupName(group.name || '');
      setGroupDescription(group.description || '');
      setNameError('');
      setDescriptionError('');
    }
  };

  // Función para validar el formulario
  const validateForm = () => {
    let isValid = true;
    
    // Validación del nombre del grupo
    if (!groupName.trim()) {
      setNameError('El nombre del grupo es requerido');
      isValid = false;
    } else if (groupName.trim().length < 3) {
      setNameError('El nombre debe tener al menos 3 caracteres');
      isValid = false;
    } else if (groupName.trim().length > 50) {
      setNameError('El nombre no puede exceder 50 caracteres');
      isValid = false;
    } else {
      setNameError('');
    }

    // Validación de la descripción
    if (groupDescription.trim().length > 300) {
      setDescriptionError('La descripción no puede exceder 300 caracteres');
      isValid = false;
    } else {
      setDescriptionError('');
    }

    return isValid;
  };

  // Función para guardar los cambios
  const handleSave = async () => {
    console.log('📝 Guardando cambios del grupo...');
    
    if (!validateForm()) {
      console.log('❌ Validación falló');
      return;
    }

    setSaving(true);

    try {
      // Preparamos los datos actualizados
      const updatedData = {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        updated_at: new Date().toISOString()
      };

      console.log('📤 Actualizando grupo con datos:', updatedData);

      // Actualizamos el grupo en la base de datos
      const { data, error } = await supabase
        .from('groups')
        .update(updatedData)
        .eq('id', group.id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando grupo:', error);
        
        if (error.code === '23505') {
          Alert.alert('Error', 'Ya existe un grupo con ese nombre en tu cuenta.');
        } else {
          Alert.alert('Error', 'No se pudo actualizar el grupo. Intenta nuevamente.');
        }
        return;
      }

      console.log('✅ Grupo actualizado exitosamente:', data);

      // Notificamos al componente padre sobre la actualización
      if (onGroupUpdated) {
        onGroupUpdated(data);
      }

      // Cerramos el modal
      onClose();

      Alert.alert(
        'Grupo Actualizado',
        'Los cambios se han guardado exitosamente.',
        [{ text: 'Perfecto', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado actualizando grupo:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // Función para manejar el cierre del modal
  const handleClose = () => {
    const hasChanges = 
      groupName !== (group?.name || '') ||
      groupDescription !== (group?.description || '');

    if (hasChanges) {
      Alert.alert(
        'Descartar Cambios',
        '¿Estás seguro de que quieres cerrar? Se perderán los cambios no guardados.',
        [
          { text: 'Continuar Editando', style: 'cancel' },
          { 
            text: 'Descartar',
            style: 'destructive',
            onPress: () => {
              initializeForm();
              onClose();
            }
          }
        ]
      );
    } else {
      onClose();
    }
  };

  // Función para resetear el formulario
  const resetForm = () => {
    initializeForm();
  };

  // Efecto para inicializar el formulario cuando se abre el modal
  useEffect(() => {
    if (visible && group) {
      initializeForm();
    }
  }, [visible, group]);

  if (!group) return null;

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
        {/* Header del modal */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Editar Grupo</Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Información actual del grupo */}
          <View style={styles.currentInfoSection}>
            <Text style={styles.sectionTitle}>📝 Información Actual</Text>
            <View style={styles.currentInfoBox}>
              <Text style={styles.currentInfoLabel}>Nombre:</Text>
              <Text style={styles.currentInfoValue}>{group.name}</Text>
              {group.description && (
                <>
                  <Text style={styles.currentInfoLabel}>Descripción:</Text>
                  <Text style={styles.currentInfoValue}>{group.description}</Text>
                </>
              )}
              <Text style={styles.currentInfoLabel}>Creado:</Text>
              <Text style={styles.currentInfoValue}>
                {new Date(group.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
          </View>

          {/* Formulario de edición */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>✏️ Editar Información</Text>
            
            {/* Campo de nombre del grupo */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Nombre del Grupo *</Text>
              <TextInput
                style={[styles.textInput, nameError ? styles.inputError : null]}
                value={groupName}
                onChangeText={(text) => {
                  setGroupName(text);
                  if (nameError) setNameError('');
                }}
                placeholder="Nombre del grupo"
                maxLength={50}
                placeholderTextColor="#95a5a6"
                autoCapitalize="words"
                autoCorrect={true}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              <Text style={styles.helperText}>
                Elige un nombre claro y descriptivo para tu grupo
              </Text>
            </View>

            {/* Campo de descripción del grupo */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Descripción del Grupo (Opcional)</Text>
              <TextInput
                style={[
                  styles.textInput, 
                  styles.textArea, 
                  descriptionError ? styles.inputError : null
                ]}
                value={groupDescription}
                onChangeText={(text) => {
                  setGroupDescription(text);
                  if (descriptionError) setDescriptionError('');
                }}
                placeholder="Describe el propósito del grupo, qué tipos de hábitos desarrollan juntos, reglas especiales, etc..."
                maxLength={300}
                multiline={true}
                numberOfLines={4}
                placeholderTextColor="#95a5a6"
                autoCapitalize="sentences"
                autoCorrect={true}
              />
              {descriptionError ? <Text style={styles.errorText}>{descriptionError}</Text> : null}
              <Text style={styles.helperText}>
                {groupDescription.length}/300 caracteres
              </Text>
            </View>

            {/* Botón de resetear */}
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetForm}
            >
              <Text style={styles.resetButtonText}>🔄 Resetear Cambios</Text>
            </TouchableOpacity>
          </View>

          {/* Información sobre el impacto de los cambios */}
          <View style={styles.impactSection}>
            <Text style={styles.sectionTitle}>⚠️ Impacto de los Cambios</Text>
            <Text style={styles.impactText}>
              • Los cambios en el nombre serán visibles para todos los miembros del grupo
            </Text>
            <Text style={styles.impactText}>
              • Los cambios en la descripción se reflejarán en las invitaciones futuras
            </Text>
            <Text style={styles.impactText}>
              • Los hábitos compartidos y listas colaborativas no se verán afectados
            </Text>
            <Text style={styles.impactText}>
              • Todos los miembros recibirán una notificación sobre los cambios
            </Text>
          </View>

          {/* Consejos para nombres de grupo */}
          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>💡 Consejos para Nombres de Grupo</Text>
            <Text style={styles.tipText}>• Sé específico: "Runners Matutinos" vs "Ejercicio"</Text>
            <Text style={styles.tipText}>• Refleja el propósito: "Familia Saludable 2024"</Text>
            <Text style={styles.tipText}>• Mantén la motivación: "Warriors del Bienestar"</Text>
            <Text style={styles.tipText}>• Considera la privacidad: evita información muy personal</Text>
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
    backgroundColor: '#27ae60',
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
  currentInfoSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
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
    marginBottom: 15,
  },
  currentInfoBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  currentInfoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginBottom: 5,
    marginTop: 10,
  },
  currentInfoValue: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 5,
    lineHeight: 22,
  },
  formSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  fieldContainer: {
    marginBottom: 20,
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
    height: 100,
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
  resetButton: {
    backgroundColor: '#f39c12',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  impactSection: {
    backgroundColor: '#fff3e0',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  impactText: {
    fontSize: 14,
    color: '#8d5524',
    lineHeight: 20,
    marginBottom: 5,
  },
  tipsSection: {
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  tipText: {
    fontSize: 12,
    color: '#2d5a3d',
    lineHeight: 18,
    marginBottom: 5,
  },
});