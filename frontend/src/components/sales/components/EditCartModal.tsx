import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { isDesktop, QUICK_AMOUNTS } from '../constants';
import { CartItem, Lottery, PlayTypeConfig } from '../types';

interface EditCartModalProps {
  visible: boolean;
  onClose: () => void;
  cartItem: CartItem | null;
  lottery: Lottery | null;
  onSave: (item: CartItem) => void;
}

export const EditCartModal: React.FC<EditCartModalProps> = ({
  visible,
  onClose,
  cartItem,
  lottery,
  onSave,
}) => {
  const [editNumbers, setEditNumbers] = useState<number[]>([]);
  const [editAmount, setEditAmount] = useState('');
  const [editNumberInput, setEditNumberInput] = useState('');

  useEffect(() => {
    if (cartItem) {
      setEditNumbers([...cartItem.numbers]);
      setEditAmount(cartItem.amount.toString());
    }
  }, [cartItem]);

  if (!cartItem || !lottery) return null;

  const playTypeConfig: PlayTypeConfig | undefined = lottery.play_types?.[cartItem.playType];
  const multiplier = playTypeConfig?.multipliers?.first || lottery.prize_multiplier || 70;
  const potentialWin = (parseFloat(editAmount) || 0) * multiplier;

  const addEditNumber = () => {
    const num = parseInt(editNumberInput);
    if (isNaN(num)) return;
    if (num < lottery.min_number || num > lottery.max_number) return;
    if (editNumbers.includes(num)) return;
    
    const maxNumbers = playTypeConfig?.numbers_count || 1;
    if (editNumbers.length >= maxNumbers) return;
    
    setEditNumbers([...editNumbers, num]);
    setEditNumberInput('');
  };

  const removeEditNumber = (num: number) => {
    setEditNumbers(editNumbers.filter(n => n !== num));
  };

  const handleSave = () => {
    const maxNumbers = playTypeConfig?.numbers_count || 1;
    if (editNumbers.length !== maxNumbers) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) return;

    onSave({
      ...cartItem,
      numbers: editNumbers,
      amount: amount,
      potentialWin: amount * multiplier,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.editCartModalContent, isDesktop && styles.modalContentDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✏️ Editar Jugada</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.editCartForm}>
            {/* Info de lotería */}
            <View style={styles.editCartInfo}>
              <Text style={styles.editCartLottery}>Lotería</Text>
              <Text style={styles.editCartLotteryName}>{cartItem.lotteryName}</Text>
            </View>

            {/* Números */}
            <Text style={styles.editCartLabel}>
              Números ({editNumbers.length}/{playTypeConfig?.numbers_count || 1})
            </Text>
            <View style={styles.editNumbersContainer}>
              {editNumbers.map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.editNumberBall}
                  onPress={() => removeEditNumber(num)}
                >
                  <Text style={styles.editNumberText}>{num.toString().padStart(2, '0')}</Text>
                  <Ionicons name="close" size={14} color="#fff" style={styles.editRemoveIcon} />
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.editNumberInputRow}>
              <TextInput
                style={styles.editNumberInput}
                value={editNumberInput}
                onChangeText={setEditNumberInput}
                placeholder={`${lottery.min_number}-${lottery.max_number}`}
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                onSubmitEditing={addEditNumber}
              />
              <TouchableOpacity style={styles.editAddNumberButton} onPress={addEditNumber}>
                <Ionicons name="add" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Monto */}
            <Text style={styles.editCartLabel}>Monto</Text>
            <View style={styles.editAmountRow}>
              <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 18 }}>
                {cartItem.currency}
              </Text>
              <TextInput
                style={styles.editAmountInput}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.editQuickAmounts}>
              {QUICK_AMOUNTS.map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={styles.editQuickAmountButton}
                  onPress={() => setEditAmount(amt.toString())}
                >
                  <Text style={styles.editQuickAmountText}>{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Premio potencial */}
            <View style={styles.editPotentialWin}>
              <Text style={styles.editPotentialLabel}>Premio Potencial</Text>
              <Text style={styles.editPotentialValue}>
                {cartItem.currency} {potentialWin.toLocaleString()}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.editSaveButton,
                editNumbers.length !== (playTypeConfig?.numbers_count || 1) && styles.buttonDisabled
              ]}
              onPress={handleSave}
              disabled={editNumbers.length !== (playTypeConfig?.numbers_count || 1)}
            >
              <Text style={styles.editSaveButtonText}>Guardar Cambios</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default EditCartModal;
