import type { PropsWithChildren, ReactNode } from 'react';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CardProps {
  readonly title?: ReactNode;
  readonly headerSpacing?: number;
}

const Card: React.FC<PropsWithChildren<CardProps>> = ({
  title,
  children,
  headerSpacing = 12,
}) => (
  <View style={styles.container}>
    {title != null ? (
      <View style={[styles.header, { marginBottom: headerSpacing }]}>
        {typeof title === 'string' ? (
          <Text style={styles.title}>{title}</Text>
        ) : (
          title
        )}
      </View>
    ) : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
});

export default Card;
