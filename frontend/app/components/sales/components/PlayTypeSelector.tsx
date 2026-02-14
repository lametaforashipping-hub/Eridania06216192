import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { PlayTypeConfig } from '../types';

interface PlayTypeSelectorProps {
  playTypes: { [key: string]: PlayTypeConfig } | undefined;
  selectedPlayType: string | null;
  onSelectPlayType: (type: string) => void;
  lotteriesCount: number;
}

export const PlayTypeSelector: React.FC<PlayTypeSelectorProps> = ({
  playTypes,
  selectedPlayType,
  onSelectPlayType,
  lotteriesCount,
}) => {
  if (!playTypes) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        <Text style={styles.stepNumber}>2</Text> Tipo de Jugada
      </Text>
      <Text style={styles.sectionSubtitle}>
        Selecciona el tipo de jugada (se aplicará a las {lotteriesCount} lotería(s) seleccionada(s))
      </Text>
      
      <View style={styles.playTypeGrid}>
        {Object.entries(playTypes).map(([key, pt]) => {
          if (!pt.enabled) return null;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.playTypeChip,
                selectedPlayType === key && styles.playTypeChipSelected,
              ]}
              onPress={() => onSelectPlayType(key)}
              data-testid={`play-type-${key}`}
            >
              <Text style={[
                styles.playTypeName,
                selectedPlayType === key && styles.playTypeNameSelected
              ]}>
                {pt.name}
              </Text>
              <Text style={styles.playTypeNumbers}>
                {pt.numbers_count} número{pt.numbers_count > 1 ? 's' : ''}
              </Text>
              <View style={styles.playTypeMultipliers}>
                <Text style={styles.playTypeMultiplier}>1ro: x{pt.multipliers.first}</Text>
                <Text style={styles.playTypeMultiplier}>2do: x{pt.multipliers.second}</Text>
                <Text style={styles.playTypeMultiplier}>3ro: x{pt.multipliers.third}</Text>
              </View>
              {selectedPlayType === key && (
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" style={styles.playTypeCheck} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default PlayTypeSelector;
