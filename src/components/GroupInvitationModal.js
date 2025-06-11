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
  Platform,
  Share,
  Clipboard
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function GroupInvitationModal({ visible, onClose, group }) {
  // Accedemos al usuario autenticado para validar permisos de administrador
  const { user, profile } = useAuth();
  
  // Estados para gestionar los dos métodos de invitación
  const [invitationMethod, setInvitationMethod] = useState('email'); // 'email' o 'code'
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [invitationMessage, setInvitationMessage] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  
  // Estados para gestionar invitaciones existentes y control de UI
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  
  // Estados para validación de formulario
  const [emailError, setEmailError] = useState('');

  // Función para cargar invitaciones pendientes del grupo actual
  // Esta función permite a los administradores ver el estado de todas las invitaciones
  const loadPendingInvitations = async () => {
    if (!group || !user) return;

    setLoadingInvitations(true);
    try {
      console.log('🔍 Cargando invitaciones pendientes para grupo:', group.name);

      const { data: invitations, error } = await supabase
        .from('group_invitations')
        .select(`
          *,
          groups (name),
          profiles:invited_by (username, full_name)
        `)
        .eq('group_id', group.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar invitaciones:', error);
        return;
      }

      console.log(`📧 Encontradas ${invitations?.length || 0} invitaciones pendientes`);
      setPendingInvitations(invitations || []);

    } catch (error) {
      console.error('Error inesperado al cargar invitaciones:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  // Función para validar formato de email usando expresión regular
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Función para enviar invitación por email
  // Esta función crea una invitación específica para un usuario identificado por su email
  const sendEmailInvitation = async () => {
    console.log('📧 Iniciando proceso de invitación por email...');
    
    // Validación de campos requeridos
    if (!inviteeEmail.trim()) {
      setEmailError('El email es requerido');
      return;
    }

    if (!validateEmail(inviteeEmail.trim())) {
      setEmailError('Por favor ingresa un email válido');
      return;
    }

    setEmailError('');
    setLoading(true);

    try {
      const emailToInvite = inviteeEmail.trim().toLowerCase();
      console.log('📧 Enviando invitación a:', emailToInvite);

      // Verificamos si ya existe una invitación pendiente para este email
      const { data: existingInvitation, error: checkError } = await supabase
        .from('group_invitations')
        .select('id, status, expires_at')
        .eq('group_id', group.id)
        .eq('invited_email', emailToInvite)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 significa "no rows found", que es lo que esperamos si no hay invitación existente
        console.error('Error al verificar invitaciones existentes:', checkError);
        Alert.alert('Error', 'No se pudo verificar invitaciones existentes.');
        return;
      }

      if (existingInvitation) {
        Alert.alert(
          'Invitación Ya Existe',
          `Ya hay una invitación pendiente para ${emailToInvite}. Espera a que responda o revoca la invitación existente.`
        );
        return;
      }

      // Verificamos si el usuario ya es miembro del grupo
      const { data: existingMember, error: memberError } = await supabase
        .from('profiles')
        .select(`
          id,
          group_members!inner (
            group_id
          )
        `)
        .eq('email', emailToInvite)
        .eq('group_members.group_id', group.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        console.error('Error al verificar membresía existente:', memberError);
      }

      if (existingMember) {
        Alert.alert(
          'Usuario Ya es Miembro',
          `El usuario con email ${emailToInvite} ya es miembro de este grupo.`
        );
        return;
      }

      // Creamos la nueva invitación
      const invitationData = {
        group_id: group.id,
        invited_by: user.id,
        invited_email: emailToInvite,
        invitation_message: invitationMessage.trim() || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
      };

      const { data: newInvitation, error: createError } = await supabase
        .from('group_invitations')
        .insert(invitationData)
        .select()
        .single();

      if (createError) {
        console.error('Error al crear invitación:', createError);
        Alert.alert('Error', 'No se pudo enviar la invitación. Intenta nuevamente.');
        return;
      }

      console.log('✅ Invitación creada exitosamente:', newInvitation);

      // Limpiamos el formulario y actualizamos la lista
      setInviteeEmail('');
      setInvitationMessage('');
      await loadPendingInvitations();

      Alert.alert(
        'Invitación Enviada',
        `Se ha enviado una invitación a ${emailToInvite}. Recibirán un email con instrucciones para unirse al grupo.`,
        [{ text: 'Perfecto', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado al enviar invitación:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Función para generar código de invitación compartible
  // Esta función crea un código único que se puede compartir por cualquier medio
  const generateInviteCode = async () => {
    console.log('🔐 Generando código de invitación...');
    setLoading(true);

    try {
      // Llamamos a la función de base de datos que genera códigos únicos
      const { data: codeResult, error: codeError } = await supabase
        .rpc('generate_invite_code');

      if (codeError) {
        console.error('Error al generar código:', codeError);
        Alert.alert('Error', 'No se pudo generar el código de invitación.');
        return;
      }

      const inviteCode = codeResult;
      console.log('🔐 Código generado:', inviteCode);

      // Creamos la invitación con el código generado
      const invitationData = {
        group_id: group.id,
        invited_by: user.id,
        invite_code: inviteCode,
        invitation_message: invitationMessage.trim() || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
      };

      const { data: newInvitation, error: createError } = await supabase
        .from('group_invitations')
        .insert(invitationData)
        .select()
        .single();

      if (createError) {
        console.error('Error al crear invitación por código:', createError);
        Alert.alert('Error', 'No se pudo crear la invitación por código.');
        return;
      }

      console.log('✅ Invitación por código creada exitosamente:', newInvitation);

      setGeneratedCode(inviteCode);
      setInvitationMessage('');
      await loadPendingInvitations();

    } catch (error) {
      console.error('Error inesperado al generar código:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Función para compartir código de invitación usando la API nativa de Share
  const shareInviteCode = async () => {
    if (!generatedCode) return;

    const shareMessage = `¡Te invito a unirte a nuestro grupo "${group.name}" en la app de hábitos!\n\nUsa este código: ${generatedCode}\n\n${invitationMessage || 'Únete y construyamos hábitos saludables juntos 💪'}`;

    try {
      const result = await Share.share({
        message: shareMessage,
        title: `Invitación a ${group.name}`,
      });

      if (result.action === Share.sharedAction) {
        console.log('📤 Código compartido exitosamente');
      }
    } catch (error) {
      console.error('Error al compartir código:', error);
      // Fallback: copiar al clipboard
      await copyCodeToClipboard();
    }
  };

  // Función para copiar código al clipboard como fallback
  const copyCodeToClipboard = async () => {
    if (!generatedCode) return;

    try {
      await Clipboard.setString(generatedCode);
      Alert.alert('Código Copiado', 'El código de invitación ha sido copiado al portapapeles.');
    } catch (error) {
      console.error('Error al copiar código:', error);
      Alert.alert('Error', 'No se pudo copiar el código. Anótalo manualmente: ' + generatedCode);
    }
  };

  // Función para revocar una invitación pendiente
  // Esto permite a los administradores cancelar invitaciones que ya no desean
  const revokeInvitation = async (invitation) => {
    Alert.alert(
      'Revocar Invitación',
      `¿Estás seguro de que quieres revocar la invitación ${invitation.invited_email ? `para ${invitation.invited_email}` : `con código ${invitation.invite_code}`}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Revocar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('group_invitations')
                .update({ status: 'revoked' })
                .eq('id', invitation.id);

              if (error) {
                console.error('Error al revocar invitación:', error);
                Alert.alert('Error', 'No se pudo revocar la invitación.');
                return;
              }

              console.log('✅ Invitación revocada exitosamente');
              await loadPendingInvitations();

              Alert.alert('Invitación Revocada', 'La invitación ha sido revocada exitosamente.');
            } catch (error) {
              console.error('Error inesperado al revocar invitación:', error);
              Alert.alert('Error Inesperado', 'Ocurrió un error inesperado.');
            }
          }
        }
      ]
    );
  };

  // Función para resetear el formulario al cambiar de método
  const handleMethodChange = (method) => {
    setInvitationMethod(method);
    setInviteeEmail('');
    setInvitationMessage('');
    setGeneratedCode('');
    setEmailError('');
  };

  // Función para manejar el cierre del modal con limpieza de estado
  const handleClose = () => {
    setInvitationMethod('email');
    setInviteeEmail('');
    setInvitationMessage('');
    setGeneratedCode('');
    setEmailError('');
    setPendingInvitations([]);
    onClose();
  };

  // Efecto para cargar invitaciones cuando se abre el modal
  useEffect(() => {
    if (visible && group) {
      loadPendingInvitations();
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
        {/* Header del modal con información del grupo */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Invitar Miembros</Text>
            <Text style={styles.groupName}>{group.name}</Text>
          </View>
          
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Selector de método de invitación */}
          <View style={styles.methodSelector}>
            <Text style={styles.sectionTitle}>Método de Invitación</Text>
            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  invitationMethod === 'email' && styles.methodButtonActive
                ]}
                onPress={() => handleMethodChange('email')}
              >
                <Text style={[
                  styles.methodButtonText,
                  invitationMethod === 'email' && styles.methodButtonTextActive
                ]}>
                  📧 Por Email
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  invitationMethod === 'code' && styles.methodButtonActive
                ]}
                onPress={() => handleMethodChange('code')}
              >
                <Text style={[
                  styles.methodButtonText,
                  invitationMethod === 'code' && styles.methodButtonTextActive
                ]}>
                  🔗 Código Compartible
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Formulario de invitación por email */}
          {invitationMethod === 'email' && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Invitación por Email</Text>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Email del Invitado *</Text>
                <TextInput
                  style={[styles.textInput, emailError ? styles.inputError : null]}
                  value={inviteeEmail}
                  onChangeText={(text) => {
                    setInviteeEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="ejemplo@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Mensaje Personal (Opcional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={invitationMessage}
                  onChangeText={setInvitationMessage}
                  placeholder="Escribe un mensaje personal para tu invitación..."
                  multiline={true}
                  numberOfLines={3}
                  maxLength={300}
                />
                <Text style={styles.helperText}>
                  Un mensaje personal hace que las invitaciones sean más acogedoras
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={sendEmailInvitation}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Enviando...' : '📧 Enviar Invitación'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Formulario de invitación por código */}
          {invitationMethod === 'code' && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Código Compartible</Text>
              
              {!generatedCode ? (
                <>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Mensaje Personal (Opcional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={invitationMessage}
                      onChangeText={setInvitationMessage}
                      placeholder="Este mensaje se incluirá cuando compartas el código..."
                      multiline={true}
                      numberOfLines={3}
                      maxLength={300}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.disabledButton]}
                    onPress={generateInviteCode}
                    disabled={loading}
                  >
                    <Text style={styles.buttonText}>
                      {loading ? 'Generando...' : '🔐 Generar Código'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Tu Código de Invitación:</Text>
                  <View style={styles.codeDisplay}>
                    <Text style={styles.codeText}>{generatedCode}</Text>
                  </View>
                  
                  <Text style={styles.codeHelper}>
                    Este código expira en 7 días. Compártelo con quien quieras invitar.
                  </Text>

                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={shareInviteCode}
                    >
                      <Text style={styles.shareButtonText}>📤 Compartir</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={copyCodeToClipboard}
                    >
                      <Text style={styles.copyButtonText}>📋 Copiar</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.generateNewButton}
                    onPress={() => setGeneratedCode('')}
                  >
                    <Text style={styles.generateNewButtonText}>🔄 Generar Nuevo Código</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Lista de invitaciones pendientes */}
          <View style={styles.pendingSection}>
            <Text style={styles.sectionTitle}>Invitaciones Pendientes</Text>
            
            {loadingInvitations ? (
              <Text style={styles.loadingText}>Cargando invitaciones...</Text>
            ) : pendingInvitations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No hay invitaciones pendientes para este grupo.
                </Text>
              </View>
            ) : (
              pendingInvitations.map((invitation) => (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationTarget}>
                      {invitation.invited_email || `Código: ${invitation.invite_code}`}
                    </Text>
                    <Text style={styles.invitationDate}>
                      Enviada: {new Date(invitation.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={styles.invitationExpiry}>
                      Expira: {new Date(invitation.expires_at).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.revokeButton}
                    onPress={() => revokeInvitation(invitation)}
                  >
                    <Text style={styles.revokeButtonText}>Revocar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Estilos que crean una interfaz intuitiva y profesional para las invitaciones
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
  headerInfo: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  groupName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  headerSpacer: {
    width: 60, // Para balancear el botón de cerrar
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  methodSelector: {
    marginTop: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  methodButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#e8f5e8',
    borderColor: '#27ae60',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  methodButtonTextActive: {
    color: '#27ae60',
  },
  formSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  primaryButton: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  codeContainer: {
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  codeDisplay: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#27ae60',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 30,
    marginBottom: 15,
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    letterSpacing: 2,
    textAlign: 'center',
  },
  codeHelper: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  shareButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  copyButton: {
    backgroundColor: '#f39c12',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  generateNewButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#27ae60',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  generateNewButtonText: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pendingSection: {
    marginBottom: 30,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  invitationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationTarget: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  invitationDate: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  invitationExpiry: {
    fontSize: 12,
    color: '#e67e22',
  },
  revokeButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  revokeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});