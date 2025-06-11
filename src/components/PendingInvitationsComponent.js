import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PendingInvitationsComponent({ onInvitationResponse }) {
  // Accedemos al usuario autenticado para cargar sus invitaciones
  const { user } = useAuth();
  
  // Estados para manejar las invitaciones pendientes del usuario
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingToInvitation, setRespondingToInvitation] = useState(null);

  // Función para cargar invitaciones pendientes dirigidas al usuario actual
  // Función modificada para cargar invitaciones pendientes
const loadPendingInvitations = async () => {
  if (!user) return;

  setLoadingInvitations(true);
  try {
    console.log('📨 Cargando invitaciones pendientes para usuario:', user.email);

    // Cargamos TODAS las invitaciones por email pendientes, no filtradas por políticas
    const { data: emailInvitations, error: emailError } = await supabase
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
      .not('invited_email', 'is', null)  // Solo invitaciones por email
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (emailError) {
      console.error('Error al cargar invitaciones por email:', emailError);
      return;
    }

    // Filtramos en el cliente las invitaciones dirigidas a este usuario
    const userInvitations = (emailInvitations || []).filter(
      invitation => invitation.invited_email.toLowerCase() === user.email.toLowerCase()
    );

    console.log(`📨 Encontradas ${userInvitations.length} invitaciones para este usuario`);
    setPendingInvitations(userInvitations);

  } catch (error) {
    console.error('Error inesperado al cargar invitaciones:', error);
  } finally {
    setLoadingInvitations(false);
  }
};

  // Función para responder a una invitación (aceptar o rechazar)
  const respondToInvitation = async (invitation, response) => {
    const actionText = response === 'accepted' ? 'aceptar' : 'rechazar';
    console.log(`📨 Usuario decidió ${actionText} invitación al grupo:`, invitation.groups.name);

    setRespondingToInvitation(invitation.id);

    try {
      // Si está aceptando, primero verificamos que no sea ya miembro del grupo
      if (response === 'accepted') {
        const { data: existingMembership, error: memberError } = await supabase
          .from('group_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('group_id', invitation.group_id)
          .single();

        if (memberError && memberError.code !== 'PGRST116') {
          console.error('Error al verificar membresía existente:', memberError);
          Alert.alert('Error', 'No se pudo verificar tu membresía actual.');
          return;
        }

        if (existingMembership) {
          Alert.alert(
            'Ya Eres Miembro',
            'Ya eres miembro de este grupo. La invitación será marcada como aceptada.'
          );
        } else {
          // Creamos la nueva membresía del usuario
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

          console.log('✅ Membresía creada exitosamente');
        }
      }

      // Actualizamos el estado de la invitación
      const { error: updateError } = await supabase
        .from('group_invitations')
        .update({
          status: response,
          responded_at: new Date().toISOString(),
          accepted_by: response === 'accepted' ? user.id : null
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error al actualizar invitación:', updateError);
        Alert.alert('Error', 'No se pudo procesar tu respuesta. Intenta nuevamente.');
        return;
      }

      console.log(`✅ Invitación ${response} exitosamente`);

      // Removemos la invitación de la lista local
      setPendingInvitations(current => 
        current.filter(inv => inv.id !== invitation.id)
      );

      // Notificamos al componente padre sobre la respuesta
      if (onInvitationResponse) {
        onInvitationResponse(invitation, response);
      }

      // Mostramos confirmación al usuario
      const successMessage = response === 'accepted' 
        ? `¡Bienvenido al grupo "${invitation.groups.name}"! Ya puedes participar en sus hábitos compartidos.`
        : `Has rechazado la invitación al grupo "${invitation.groups.name}".`;

      Alert.alert(
        response === 'accepted' ? '¡Invitación Aceptada!' : 'Invitación Rechazada',
        successMessage,
        [{ text: 'Perfecto', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado al responder invitación:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setRespondingToInvitation(null);
    }
  };

  // Función para mostrar confirmación antes de responder
  const confirmResponse = (invitation, response) => {
    const actionText = response === 'accepted' ? 'aceptar' : 'rechazar';
    const groupName = invitation.groups.name;
    const inviterName = invitation.profiles?.full_name || invitation.profiles?.username || 'un miembro';

    let message = `¿Estás seguro de que quieres ${actionText} la invitación al grupo "${groupName}"?`;
    
    if (response === 'accepted') {
      message += `\n\nAl aceptar, podrás participar en hábitos compartidos y listas colaborativas del grupo.`;
    }

    Alert.alert(
      `${response === 'accepted' ? 'Aceptar' : 'Rechazar'} Invitación`,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: response === 'accepted' ? 'Aceptar' : 'Rechazar',
          style: response === 'accepted' ? 'default' : 'destructive',
          onPress: () => respondToInvitation(invitation, response)
        }
      ]
    );
  };

  // Función para calcular días restantes hasta la expiración
  const getDaysUntilExpiry = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Efecto para cargar invitaciones cuando el componente se monta
  useEffect(() => {
    if (user) {
      loadPendingInvitations();
    }
  }, [user]);

  // Si no hay invitaciones pendientes, no mostramos nada
  if (loading || pendingInvitations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📨 Invitaciones Pendientes</Text>
      
      <ScrollView style={styles.invitationsList} showsVerticalScrollIndicator={false}>
        {pendingInvitations.map((invitation) => (
          <View key={invitation.id} style={styles.invitationCard}>
            <View style={styles.invitationHeader}>
              <Text style={styles.groupName}>{invitation.groups.name}</Text>
              <Text style={styles.expiryText}>
                {getDaysUntilExpiry(invitation.expires_at)} días restantes
              </Text>
            </View>
            
            {invitation.groups.description && (
              <Text style={styles.groupDescription}>{invitation.groups.description}</Text>
            )}
            
            <Text style={styles.inviterText}>
              Invitación de: {invitation.profiles?.full_name || invitation.profiles?.username || 'Usuario'}
            </Text>
            
            {invitation.invitation_message && (
              <View style={styles.messageContainer}>
                <Text style={styles.messageLabel}>Mensaje personal:</Text>
                <Text style={styles.messageText}>{invitation.invitation_message}</Text>
              </View>
            )}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.responseButton,
                  styles.acceptButton,
                  respondingToInvitation === invitation.id && styles.disabledButton
                ]}
                onPress={() => confirmResponse(invitation, 'accepted')}
                disabled={respondingToInvitation === invitation.id}
              >
                <Text style={styles.acceptButtonText}>
                  {respondingToInvitation === invitation.id ? 'Procesando...' : '✅ Aceptar'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.responseButton,
                  styles.rejectButton,
                  respondingToInvitation === invitation.id && styles.disabledButton
                ]}
                onPress={() => confirmResponse(invitation, 'rejected')}
                disabled={respondingToInvitation === invitation.id}
              >
                <Text style={styles.rejectButtonText}>
                  {respondingToInvitation === invitation.id ? 'Procesando...' : '❌ Rechazar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff3e0',
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
    color: '#f39c12',
    marginBottom: 15,
    textAlign: 'center',
  },
  invitationsList: {
    maxHeight: 300, // Limitamos la altura para no dominar la pantalla
  },
  invitationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#f39c12',
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  expiryText: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '600',
  },
  groupDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
    lineHeight: 18,
  },
  inviterText: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  responseButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#27ae60',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});