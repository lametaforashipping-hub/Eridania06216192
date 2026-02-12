import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface TicketVerification {
  ticket_number: string;
  status: string;
  is_winner: boolean;
  is_paid: boolean;
  lottery_name: string;
  numbers: number[];
  plays: any[];
  amount: number;
  potential_win: number;
  currency: string;
  created_at: string;
  customer_name?: string;
  message: string;
}

export default function Scanner() {
  const { token } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(isWeb);
  const [result, setResult] = useState<TicketVerification | null>(null);
  const [showResult, setShowResult] = useState(false);

  const verifyTicket = async (ticketNumber: string) => {
    if (!ticketNumber.trim()) {
      Alert.alert('Error', 'Ingresa un número de boleto');
      return;
    }

    setVerifying(true);
    setScanning(false);
    
    try {
      const response = await fetch(`${API_URL}/api/tickets/verify/${ticketNumber.trim()}`);
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setShowResult(true);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Boleto no encontrado');
        setScanning(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
      setScanning(true);
    } finally {
      setVerifying(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanning || verifying) return;
    
    // Extract ticket number from scanned data
    // Format could be: "TKT-XXXXXX" or just the ticket number
    const ticketNumber = data.includes('TKT-') ? data : data;
    verifyTicket(ticketNumber);
  };

  const resetScanner = () => {
    setResult(null);
    setShowResult(false);
    setScanning(true);
    setManualInput('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return '#22c55e';
      case 'paid': return '#3b82f6';
      case 'lost': return '#ef4444';
      case 'cancelled': return '#64748b';
      default: return '#f59e0b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won': return 'trophy';
      case 'paid': return 'checkmark-circle';
      case 'lost': return 'close-circle';
      case 'cancelled': return 'ban';
      default: return 'time';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won': return 'GANADOR';
      case 'paid': return 'PAGADO';
      case 'lost': return 'PERDIDO';
      case 'cancelled': return 'CANCELADO';
      default: return 'PENDIENTE';
    }
  };

  // For web, show manual input mode
  if (isWeb || showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verificar Boleto</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.manualContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="barcode-outline" size={80} color="#22c55e" />
          </View>
          
          <Text style={styles.manualTitle}>Verificar Boleto</Text>
          <Text style={styles.manualSubtitle}>
            Ingresa el número del boleto para verificar si es ganador
          </Text>

          <TextInput
            style={styles.manualInput}
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="Ej: TKT-123456"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.verifyButton, verifying && styles.verifyButtonDisabled]}
            onPress={() => verifyTicket(manualInput)}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="search" size={22} color="#ffffff" />
                <Text style={styles.verifyButtonText}>Verificar Boleto</Text>
              </>
            )}
          </TouchableOpacity>

          {!isWeb && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setShowManualInput(false)}
            >
              <Ionicons name="camera" size={20} color="#22c55e" />
              <Text style={styles.switchButtonText}>Usar Cámara</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Result Modal */}
        <Modal visible={showResult} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Resultado de Verificación</Text>
                <TouchableOpacity onPress={resetScanner}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {result && (
                <View style={styles.resultContainer}>
                  <View style={[styles.resultIconContainer, { backgroundColor: getStatusColor(result.status) + '30' }]}>
                    <Ionicons 
                      name={getStatusIcon(result.status) as any} 
                      size={60} 
                      color={getStatusColor(result.status)} 
                    />
                  </View>

                  <Text style={[styles.resultStatus, { color: getStatusColor(result.status) }]}>
                    {getStatusText(result.status)}
                  </Text>

                  <Text style={styles.resultMessage}>{result.message}</Text>

                  <View style={styles.resultDetails}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Boleto:</Text>
                      <Text style={styles.resultValue}>{result.ticket_number}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Lotería:</Text>
                      <Text style={styles.resultValue}>{result.lottery_name}</Text>
                    </View>
                    {result.numbers.length > 0 && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Números:</Text>
                        <Text style={styles.resultValue}>
                          {result.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}
                        </Text>
                      </View>
                    )}
                    {result.plays && result.plays.length > 0 && (
                      <View style={styles.playsContainer}>
                        <Text style={styles.resultLabel}>Jugadas:</Text>
                        {result.plays.map((play, idx) => (
                          <View key={idx} style={styles.playItem}>
                            <Text style={styles.playType}>{play.lottery_type?.toUpperCase()}</Text>
                            <Text style={styles.playNumbers}>
                              {play.numbers?.map((n: number) => n.toString().padStart(2, '0')).join('-')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Monto:</Text>
                      <Text style={styles.resultValue}>
                        {result.currency} {result.amount.toLocaleString()}
                      </Text>
                    </View>
                    {result.is_winner && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Premio:</Text>
                        <Text style={[styles.resultValue, styles.prizeValue]}>
                          {result.currency} {result.potential_win.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {result.customer_name && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Cliente:</Text>
                        <Text style={styles.resultValue}>{result.customer_name}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity style={styles.newScanButton} onPress={resetScanner}>
                    <Ionicons name="refresh" size={20} color="#ffffff" />
                    <Text style={styles.newScanButtonText}>Verificar Otro Boleto</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Camera permission handling for mobile
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verificar Boleto</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#64748b" />
          <Text style={styles.permissionTitle}>Permiso de Cámara</Text>
          <Text style={styles.permissionText}>
            Necesitamos acceso a la cámara para escanear códigos de boletos
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Ionicons name="camera" size={20} color="#ffffff" />
            <Text style={styles.permissionButtonText}>Permitir Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualInput(true)}
          >
            <Ionicons name="keypad" size={20} color="#22c55e" />
            <Text style={styles.manualButtonText}>Ingresar Manualmente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera scanner view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Escanear Boleto</Text>
        <TouchableOpacity onPress={() => setShowManualInput(true)}>
          <Ionicons name="keypad" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
          }}
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>
        </CameraView>

        {verifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text style={styles.verifyingText}>Verificando...</Text>
          </View>
        )}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Apunta la cámara al código de barras del boleto
        </Text>
      </View>

      {/* Result Modal */}
      <Modal visible={showResult} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Resultado</Text>
              <TouchableOpacity onPress={resetScanner}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {result && (
              <View style={styles.resultContainer}>
                <View style={[styles.resultIconContainer, { backgroundColor: getStatusColor(result.status) + '30' }]}>
                  <Ionicons 
                    name={getStatusIcon(result.status) as any} 
                    size={60} 
                    color={getStatusColor(result.status)} 
                  />
                </View>

                <Text style={[styles.resultStatus, { color: getStatusColor(result.status) }]}>
                  {getStatusText(result.status)}
                </Text>

                <Text style={styles.resultMessage}>{result.message}</Text>

                <View style={styles.resultDetails}>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Boleto:</Text>
                    <Text style={styles.resultValue}>{result.ticket_number}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Lotería:</Text>
                    <Text style={styles.resultValue}>{result.lottery_name}</Text>
                  </View>
                  {result.is_winner && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Premio:</Text>
                      <Text style={[styles.resultValue, styles.prizeValue]}>
                        {result.currency} {result.potential_win.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={styles.newScanButton} onPress={resetScanner}>
                  <Ionicons name="scan" size={20} color="#ffffff" />
                  <Text style={styles.newScanButtonText}>Escanear Otro</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#22c55e',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 16,
  },
  instructions: {
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },
  permissionText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  manualButtonText: {
    color: '#22c55e',
    fontSize: 14,
    marginLeft: 8,
  },
  manualContainer: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  manualTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  manualInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  switchButtonText: {
    color: '#22c55e',
    fontSize: 14,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  resultContainer: {
    padding: 20,
    alignItems: 'center',
  },
  resultIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultStatus: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  resultDetails: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  resultLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  resultValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  prizeValue: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 16,
  },
  playsContainer: {
    marginTop: 8,
  },
  playItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingLeft: 12,
  },
  playType: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  playNumbers: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  newScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
  },
  newScanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});
