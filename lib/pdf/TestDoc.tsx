import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { 
    padding: 30, 
    fontSize: 12, 
    fontFamily: 'Helvetica' 
  },
  section: { 
    marginBottom: 10 
  }
});

const TestDoc = ({ date }: { date: string }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text>Server Test Document</Text>
      </View>
      <View style={styles.section}>
        <Text>Date: {date}</Text>
      </View>
    </Page>
  </Document>
);

export default TestDoc;
