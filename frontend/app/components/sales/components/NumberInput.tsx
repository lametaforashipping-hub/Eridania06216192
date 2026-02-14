import React, { RefObject } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { Lottery, PlayTypeConfig } from '../types';

interface NumberInputProps {
  lottery: Lottery;
  playTypeConfig: PlayTypeConfig;
  selectedNumbers: number[];
  numberInput: string;
  amount: string;
  inputRef: RefObject<TextInput>;
  amountRef: RefObject<TextInput>;
  onNumberInputChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onAddNumber: () => void;
  onRemoveNumber: (num: number) => void;
  onQuickPick: () => void;
  onAddToCart: () => void;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  lottery,
  playTypeConfig,
  selectedNumbers,
  numberInput,
  amount,
  inputRef,
  amountRef,
  onNumberInputChange,
  onAmountChange,
  onAddNumber,
  onRemoveNumber,
  onQuickPick,
  onAddToCart,
}) => {
  const canAddToCart = selectedNumbers.length === playTypeConfig.numbers_count;

  return (
    <>
      {/* Step 3: Enter Numbers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Text style={styles.stepNumber}>3</Text> Ingresar Números ({playTypeConfig.name})
        </Text>
        <Text style={styles.sectionSubtitle}>
          Rango: {lottery.min_number}-{lottery.max_number} | Seleccionar: {playTypeConfig.numbers_count} número(s)
        </Text>
        <View style={styles.numberInputRow}>
          <TextInput
            ref={inputRef}
            style={styles.numberInput}
            value={numberInput}
            onChangeText={onNumberInputChange}
            placeholder={`Ej: ${lottery.min_number}`}
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            maxLength={3}
            onSubmitEditing={onAddNumber}
            data-testid="number-input"
          />
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={onAddNumber}
            data-testid="add-number-btn"
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.randomButton} 
            onPress={onQuickPick}
            data-testid="quick-pick-btn"
          >
            <Ionicons name="shuffle" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={styles.selectedNumbers}>
          {selectedNumbers.length > 0 ? (
            selectedNumbers.map(num => (
              <TouchableOpacity
                key={num}
                style={styles.selectedBall}
                onPress={() => onRemoveNumber(num)}
              >
                <Text style={styles.selectedBallText}>{num.toString().padStart(2, '0')}</Text>
                <Ionicons name="close" size={14} color="#fff" style={styles.removeBallIcon} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noNumbers}>Ingresa {playTypeConfig.numbers_count} número(s)</Text>
          )}
        </View>
      </View>

      {/* Step 4: Amount and Add to Cart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Text style={styles.stepNumber}>4</Text> Monto y Agregar
        </Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>{lottery.currency}</Text>
          <TextInput
            ref={amountRef}
            style={styles.amountInput}
            value={amount}
            onChangeText={onAmountChange}
            keyboardType="numeric"
            placeholder="20"
            placeholderTextColor="#64748b"
            data-testid="amount-input"
          />
          <TouchableOpacity
            style={[styles.addToCartButton, !canAddToCart && styles.buttonDisabled]}
            onPress={onAddToCart}
            disabled={!canAddToCart}
            data-testid="add-to-cart-btn"
          >
            <Ionicons name="cart" size={20} color="#ffffff" />
            <Text style={styles.addToCartText}>Agregar {playTypeConfig.name}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

export default NumberInput;
