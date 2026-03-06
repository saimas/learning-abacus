import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../theme/colors";

type QuizPanelProps = {
  target: number;
  answer: number;
  lastResult: "correct" | "wrong" | null;
  onCheck: () => void;
  onNext: () => void;
  onReset: () => void;
};

export const QuizPanel = ({
  target,
  answer,
  lastResult,
  onCheck,
  onNext,
  onReset,
}: QuizPanelProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>今日のそろばんチャレンジ</Text>
      <Text style={styles.question}>問題: {target}</Text>
      <Text style={styles.answer}>あなたの答え: {answer}</Text>
      <View style={styles.resultRow}>
        {lastResult === "correct" && (
          <Text style={[styles.result, styles.correct]}>正解！</Text>
        )}
        {lastResult === "wrong" && (
          <Text style={[styles.result, styles.wrong]}>もう一度！</Text>
        )}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={onCheck}>
          <Text style={styles.buttonText}>答え合わせ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={onNext}>
          <Text style={styles.buttonText}>次の問題</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.resetButton} onPress={onReset}>
        <Text style={styles.resetText}>リセット</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  question: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  answer: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  resultRow: {
    minHeight: 24,
    marginTop: 8,
  },
  result: {
    fontSize: 16,
    fontWeight: "700",
  },
  correct: {
    color: colors.success,
  },
  wrong: {
    color: colors.error,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.textSecondary,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  resetButton: {
    marginTop: 12,
    alignSelf: "center",
  },
  resetText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
});
