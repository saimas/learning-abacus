import React from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Abacus } from "./src/components/Abacus/Abacus";
import { QuizPanel } from "./src/components/Quiz/QuizPanel";
import { useAbacus } from "./src/hooks/useAbacus";
import { useQuiz } from "./src/hooks/useQuiz";
import { colors } from "./src/theme/colors";

const ROD_COUNT = 5;

const App = () => {
  const { state, value, reset, toggleLower, toggleUpper, setValue } = useAbacus(ROD_COUNT);
  const { target, lastResult, nextQuestion, checkAnswer } = useQuiz(ROD_COUNT);

  const handleCheck = () => {
    checkAnswer(value);
  };

  const handleNext = () => {
    nextQuestion();
    reset();
  };

  const handleReset = () => {
    reset();
    setValue(0);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>そろばんトレーニング</Text>
          <Text style={styles.subtitle}>珠を弾いて答えを作ろう</Text>
        </View>
        <Abacus state={state} onToggleUpper={toggleUpper} onToggleLower={toggleLower} />
        <QuizPanel
          target={target}
          answer={value}
          lastResult={lastResult}
          onCheck={handleCheck}
          onNext={handleNext}
          onReset={handleReset}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default App;
