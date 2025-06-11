import React, { useState } from 'react';
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

export default function GroupCreationModal({ visible, onClose, onGroupCreated }) {
  // Accedemos al usuario autenticado para establecer la propiedad del grupo
  const { user, profile } = useAuth();
  
  // Estados para todos los campos del formulario de creación de grupo
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Estados para validación y manejo de errores
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  // Función que limpia completamente el formulario
// Función para limpiar completamente el formulario
// Esta función ya existe correctamente en tu archivo, asegúrate de que sea la única
const resetForm = () => {
  setGroupName('');
  setGroupDescription('');
  setNameError('');
  setDescriptionError('');
};
  // Función de validación que asegura que los datos del grupo sean apropiados
  const validateForm = () => {
    let isValid = true;
    
    // Validación del nombre del grupo: debe ser claro y apropiado para un contexto social
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

    // Validación de la descripción: opcional pero con límites apropiados
    if (groupDescription.trim().length > 300) {
      setDescriptionError('La descripción no puede exceder 300 caracteres');
      isValid = false;
    } else {
      setDescriptionError('');
    }

    return isValid;
  };

  // Función principal que maneja la creación del grupo en la base de datos
  const handleCreateGroup = async () => {
    console.log('🏗️ GroupCreationModal: Iniciando creación de grupo...');
    
    if (!validateForm()) {
      console.log('🏗️ GroupCreationModal: Validación falló');
      return;
    }

    setCreating(true);

    try {
      // Preparamos los datos del grupo para insertar en la base de datos
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        created_by: user.id
      };

      console.log('🏗️ GroupCreationModal: Creando grupo con datos:', groupData);

      // Creamos el grupo en la base de datos
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert(groupData)
        .select()
        .single();

      if (groupError) {
        console.error('🏗️ GroupCreationModal: Error al crear grupo:', groupError);
        Alert.alert('Error', 'No se pudo crear el grupo. Intenta nuevamente.');
        return;
      }

      console.log('🏗️ GroupCreationModal: Grupo creado exitosamente:', newGroup);

      // Automáticamente añadimos al creador como administrador del grupo
      console.log('🏗️ GroupCreationModal: Añadiendo creador como administrador...');
      const { error: membershipError } = await supabase
        .from('group_members')
        .insert({
          group_id: newGroup.id,
          user_id: user.id,
          role: 'admin'
        });

      if (membershipError) {
        console.error('🏗️ GroupCreationModal: Error al crear membresía:', membershipError);
        // Si falla la membresía, intentamos limpiar eliminando el grupo creado
        await supabase.from('groups').delete().eq('id', newGroup.id);
        Alert.alert('Error', 'No se pudo configurar el grupo correctamente. Intenta nuevamente.');
        return;
      }

      console.log('🏗️ GroupCreationModal: Membresía de administrador creada exitosamente');

      // Notificamos al componente padre sobre el éxito
      if (onGroupCreated) {
        onGroupCreated(newGroup);
      }

      // Cerramos el modal y limpiamos el formulario
      onClose();
      resetForm();

      // Mostramos confirmación con información útil sobre los siguientes pasos
      Alert.alert(
        'Grupo Creado',
        `"${newGroup.name}" ha sido creado exitosamente. Ahora puedes invitar amigos y empezar a compartir hábitos juntos.`,
        [{ text: 'Genial!', style: 'default' }]
      );

    } catch (error) {
      console.error('🏗️ GroupCreationModal: Error inesperado:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setCreating(false);
    }
  };

  // Función que maneja el cierre del modal con confirmación si hay cambios
  const handleClose = () => {
    const hasChanges = groupName.trim() !== '' || groupDescription.trim() !== '';

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
              resetForm();
              onClose();
            }
          }
        ]
      );
    } else {
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
        {/* Header del modal con controles de navegación */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Crear Grupo</Text>
          
          <TouchableOpacity 
            onPress={handleCreateGroup} 
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            disabled={creating}
          >
            <Text style={styles.createButtonText}>
              {creating ? 'Creando...' : 'Crear'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Campo de nombre del grupo */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Nombre del Grupo *</Text>
            <TextInput
              style={[styles.textInput, nameError ? styles.inputError : null]}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="ej. Amigos del Gym, Familia Saludable, Compañeros de Trabajo..."
              maxLength={50}
              placeholderTextColor="#95a5a6"
              autoCapitalize="words"
              autoCorrect={true}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            <Text style={styles.helperText}>
              Elige un nombre que refleje el propósito y la personalidad de tu grupo
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
              onChangeText={setGroupDescription}
              placeholder="Describe el propósito del grupo, qué tipos de hábitos quieren desarrollar juntos, o cualquier regla o expectativa especial..."
              maxLength={300}
              multiline={true}
              numberOfLines={4}
              placeholderTextColor="#95a5a6"
              autoCapitalize="sentences"
              autoCorrect={true}
            />
            {descriptionError ? <Text style={styles.errorText}>{descriptionError}</Text> : null}
            <Text style={styles.helperText}>
              Una buena descripción ayuda a los miembros entender las expectativas del grupo
            </Text>
          </View>

          {/* Información sobre roles y funcionalidades del grupo */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>🎯 Como creador del grupo, podrás:</Text>
            <Text style={styles.infoText}>• Invitar y remover miembros</Text>
            <Text style={styles.infoText}>• Crear hábitos compartidos para el grupo</Text>
            <Text style={styles.infoText}>• Gestionar listas colaborativas</Text>
            <Text style={styles.infoText}>• Modificar la información del grupo</Text>
          </View>

          {/* Configuración de compartir con grupos - solo si el usuario tiene grupos donde es admin */}


          {/* Consejos para crear grupos exitosos */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 Consejos para grupos exitosos:</Text>
            <Text style={styles.tipText}>• Empieza pequeño: 3-5 personas es ideal para comenzar</Text>
            <Text style={styles.tipText}>• Define expectativas claras desde el inicio</Text>
            <Text style={styles.tipText}>• Celebra los logros grupales e individuales</Text>
            <Text style={styles.tipText}>• Mantén comunicación positiva y de apoyo</Text>
            <Text style={styles.tipText}>• Sé consistente pero comprensivo con las dificultades</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Estilos que crean una experiencia de creación de grupos acogedora y profesional
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
  createButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  createButtonText: {
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
  infoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#1565c0',
    marginBottom: 5,
    lineHeight: 16,
  },
  tipsContainer: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    borderRadius: 12,
    marginTop: 10,
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