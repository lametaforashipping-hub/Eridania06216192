import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { Lottery } from '../types';

interface LotterySelectorProps {
  lotteries: Lottery[];
  selectedLotteries: string[];
  onToggleLottery: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const LotterySelector: React.FC<LotterySelectorProps> = ({
  lotteries,
  selectedLotteries,
  onToggleLottery,
  onSelectAll,
  onClearSelection,
}) => {
  const openLotteries = lotteries.filter(l => l.is_open);
  const allSelected = openLotteries.length > 0 && 
    openLotteries.every(l => selectedLotteries.includes(l.id));

  const renderLotteryChip = (lottery: Lottery) => {
    const isSelected = selectedLotteries.includes(lottery.id);
    const flag = lottery.country === 'RD' ? '🇩🇴' : '🇺🇸';

    return (
      <TouchableOpacity
        key={lottery.id}
        style={[
          styles.lotteryChip,
          isSelected && styles.lotteryChipSelected,
          !lottery.is_open && styles.lotteryChipDisabled,
        ]}
        onPress={() => onToggleLottery(lottery.id)}
        disabled={!lottery.is_open}
        data-testid={`lottery-chip-${lottery.id}`}
      >
        <View style={styles.lotteryChipContent}>
          <Text style={styles.lotteryChipFlag}>{flag}</Text>
          <Text style={[
            styles.lotteryChipName,
            isSelected && styles.lotteryChipNameSelected
          ]}>
            {lottery.name}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
          )}
        </View>
        <Text style={styles.lotteryChipInfo}>
          {lottery.is_open ? `${lottery.currency}` : 'Cerrada'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          <Text style={styles.stepNumber}>1</Text> Seleccionar Loterías
        </Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={onSelectAll}
          data-testid="select-all-lotteries"
        >
          <Ionicons
            name={allSelected ? 'checkbox' : 'checkbox-outline'}
            size={18}
            color="#22c55e"
          />
          <Text style={styles.selectAllText}>
            {allSelected ? 'Deseleccionar' : 'Todas'}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedLotteries.length > 0 && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>
            {selectedLotteries.length} lotería(s) seleccionada(s)
          </Text>
        </View>
      )}

      <View style={styles.lotteryGrid}>
        {lotteries.map(renderLotteryChip)}
      </View>

      {selectedLotteries.length > 0 && (
        <View style={styles.selectionSummary}>
          <Text style={styles.selectionText}>
            {selectedLotteries.length} lotería(s) seleccionada(s)
          </Text>
          <TouchableOpacity onPress={onClearSelection}>
            <Text style={styles.clearSelectionText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      )}

      {lotteries.length === 0 && (
        <Text style={styles.noLotteryText}>
          No hay loterías disponibles en este momento
        </Text>
      )}
    </View>
  );
};

export default LotterySelector;
