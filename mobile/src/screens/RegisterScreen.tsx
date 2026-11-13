import React from 'react';
import { useNavigation } from '@react-navigation/native';

export default function RegisterScreen() {
  const navigation = useNavigation() as any;
  React.useEffect(() => {
    navigation.replace('Login');
  }, []);
  return null;
}
