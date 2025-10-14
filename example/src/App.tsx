import { View, StyleSheet } from 'react-native';
// import { SensitiveInfoView } from 'react-native-sensitive-info';

export default function App() {
  return (
    <View style={styles.container}>
      {/** @TODO create an updated example in here */}
      {/* <SensitiveInfoView color="#32a852" style={styles.box} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
