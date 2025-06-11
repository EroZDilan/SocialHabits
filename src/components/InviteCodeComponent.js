import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function InviteCodeComponent({ onCodeAccepted }) {
  // Accedemos al usuario autenticado para procesar la unión al grupo
  const { user } = useAuth();
  
  // Estados para manejar el código de invitación
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Función para limpiar y formatear el código ingresado
  const formatInviteCode = (code) => {
    // Removemos espacios y convertimos a mayúsculas
    return code.replace(/\s/g, '').toUpperCase();
  };

  // Función para validar y procesar un código de invitación
  const processInviteCode = async () => {
    const formattedCode = formatInviteCode(inviteCode.trim());
    
    // Validación básica del formato del código
    if (!formattedCode) {
      setCodeError('Por favor ingresa un código de invitación');
      return;
    }

    if (formattedCode.length !== 8) {
      setCodeError('Los códigos de invitación tienen 8 caracteres');
      return;
    }

    setCodeError('');
    setLoading(true);

    try {
      console.log('🔐 Procesando código de invitación:', formattedCode);

      // Buscamos la invitación por código
      const { data: invitation, error: invitationError } = await supabase
        .from('group_invitations')
        .select(`
          *,
          groups (
            id,
            name,
            description
          ),
          profiles:invited_by (
            username,
            full_name
          )
        `)
        .eq('invite_code', formattedCode)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invitationError) {
        if (invitationError.code === 'PGRST116') {
          setCodeError('Código inválido, expirado o ya utilizado');
          return;
        }
        console.error('Error al buscar invitación:', invitationError);
        Alert.alert('Error', 'No se pudo verificar el código. Intenta nuevamente.');
        return;
      }

      console.log('🔐 Invitación encontrada para grupo:', invitation.groups.name);

      // Verificamos si el usuario ya es miembro del grupo
      const { data: existingMembership, error: memberError } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', invitation.group_id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        console.error('Error al verificar membresía:', memberError);
        Alert.alert('Error', 'No se pudo verificar tu membresía actual.');
        return;
      }

      if (existingMembership) {
        Alert.alert(
          'Ya Eres Miembro',
          `Ya eres miembro del grupo "${invitation.groups.name}".`
        );
        setInviteCode('');
        return;
      }

      // Mostramos los detalles del grupo y pedimos confirmación
      showInvitationDetails(invitation);

    } catch (error) {
      console.error('Error inesperado al procesar código:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Función para mostrar detalles de la invitación y pedir confirmación
  const showInvitationDetails = (invitation) => {
    const groupName = invitation.groups.name;
    const inviterName = invitation.profiles?.full_name || invitation.profiles?.username || 'un miembro';
    const description = invitation.groups.description;
    const message = invitation.invitation_message;

    let alertMessage = `Te han invitado a unirte al grupo "${groupName}".`;
    
    if (description) {
      alertMessage += `\n\nDescripción: ${description}`;
    }
    
    if (message) {
      alertMessage += `\n\nMensaje personal: ${message}`;
    }
    
    alertMessage += `\n\nInvitación de: ${inviterName}`;
    alertMessage += `\n\n¿Te gustaría unirte a este grupo?`;

    Alert.alert(
      '🎉 ¡Invitación Encontrada!',
      alertMessage,
      [
        { text: 'No, gracias', style: 'cancel' },
        { 
          text: 'Sí, unirme',
          style: 'default',
          onPress: () => acceptInvitationByCode(invitation)
        }
      ]
    );
  };

  // Función para aceptar la invitación y unirse al grupo
  const acceptInvitationByCode = async (invitation) => {
    console.log('🔐 Aceptando invitación por código para grupo:', invitation.groups.name);
    setLoading(true);

    try {
      // Creamos la nueva membresía
      const { error: membershipError } = await supabase
        .from('group_members')
        .insert({
          group_id: invitation.group_id,
          user_id: user.id,
          role: 'member'
        });

      if (membershipError) {
        console.error('Error al crear membresía:', membershipError);
        Alert.alert('Error', 'No se pudo unir al grupo. Intenta nuevamente.');
        return;
      }

      // Actualizamos el estado de la invitación
      const { error: updateError } = await supabase
        .from('group_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
          accepted_by: user.id
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error al actualizar invitación:', updateError);
        // No mostramos error al usuario porque la membresía ya se creó exitosamente
      }

      console.log('✅ Unión al grupo completada exitosamente');

      // Limpiamos el campo de código
      setInviteCode('');

      // Notificamos al componente padre
      if (onCodeAccepted) {
        onCodeAccepted(invitation);
      }

      // Mostramos confirmación de éxito
      Alert.alert(
        '🎉 ¡Bienvenido al Grupo!',
        `Te has unido exitosamente al grupo "${invitation.groups.name}". Ya puedes participar en sus hábitos compartidos y listas colaborativas.`,
        [{ text: '¡Genial!', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado al aceptar invitación:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Función para manejar cambios en el input del código
  const handleCodeChange = (text) => {
    const formattedText = formatInviteCode(text);
    setInviteCode(formattedText);
    
    // Limpiamos errores cuando el usuario empieza a escribir
    if (codeError) {
      setCodeError('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔗 Unirse con Código</Text>
      <Text style={styles.subtitle}>
        ¿Tienes un código de invitación? Ingrésalo aquí para unirte al grupo
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Código de Invitación</Text>
        <TextInput
          style={[styles.codeInput, codeError ? styles.inputError : null]}
          value={inviteCode}
          onChangeText={handleCodeChange}
          placeholder="Ej: GRUP2X7K"
          placeholderTextColor="#95a5a6"
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
        {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}
        <Text style={styles.helperText}>
          Los códigos son de 8 caracteres (letras y números)
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.joinButton, loading && styles.disabledButton]}
        onPress={processInviteCode}
        disabled={loading || !inviteCode.trim()}
      >
        <Text style={styles.joinButtonText}>
          {loading ? '🔍 Buscando...' : '🚀 Unirse al Grupo'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#1565c0',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: '#2196f3',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    backgroundColor: '#ffffff',
    color: '#2c3e50',
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  helperText: {
    color: '#1565c0',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  joinButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});