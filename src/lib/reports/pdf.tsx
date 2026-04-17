// React-PDF weekly report template. Node-renders to a Buffer.

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";
import type { ReportCompilation } from "./compiler";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { borderBottomWidth: 2, borderBottomColor: "#0284c7", paddingBottom: 6, marginBottom: 14 },
  h1:     { fontSize: 18, fontWeight: 700, color: "#0c4a6e" },
  meta:   { fontSize: 9, color: "#475569", marginTop: 2 },
  h2:     { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: "#0c4a6e",
            borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 2 },
  p:      { marginBottom: 4, lineHeight: 1.4 },
  bullet: { marginLeft: 10, marginBottom: 2, lineHeight: 1.4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  tableCell: { padding: 4 },
  th: { backgroundColor: "#f1f5f9", fontWeight: 700 },
  footer: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    borderTopWidth: 0.5, borderTopColor: "#cbd5e1", paddingTop: 6,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 8, color: "#64748b",
  },
  pillGreen: { color: "#16a34a", fontWeight: 700 },
  pillAmber: { color: "#d97706", fontWeight: 700 },
  pillRed:   { color: "#dc2626", fontWeight: 700 },
  pillGrey:  { color: "#475569" },
});

function RagPill({ rag }: { rag: string }) {
  const s =
    rag === "green" ? styles.pillGreen :
    rag === "amber" ? styles.pillAmber :
    rag === "red"   ? styles.pillRed   : styles.pillGrey;
  return <Text style={s}>{rag.toUpperCase()}</Text>;
}

// Very light markdown interpreter — only handles what the prompt produces.
function renderMarkdown(md: string) {
  const blocks: React.ReactNode[] = [];
  const lines = md.split("\n");
  let i = 0;
  let blockIdx = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      blocks.push(<Text key={`h-${blockIdx++}`} style={styles.h2}>{line.slice(3).trim()}</Text>);
      i++; continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <Text key={`h3-${blockIdx++}`} style={{ fontSize: 10, fontWeight: 700, marginTop: 6 }}>
          {line.slice(4).trim()}
        </Text>,
      );
      i++; continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <View key={`ul-${blockIdx++}`}>
          {items.map((t, idx) => <Text key={idx} style={styles.bullet}>• {t}</Text>)}
        </View>,
      );
      continue;
    }

    if (line.startsWith("| ")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((l) => !/^\|\s*-+/.test(l))
        .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
      blocks.push(
        <View key={`tbl-${blockIdx++}`}>
          {rows.map((cells, idx) => (
            <View key={idx} style={[styles.tableRow, idx === 0 ? styles.th : {}]}>
              {cells.map((c, j) => (
                <View key={j} style={[styles.tableCell, { flex: 1 }]}>
                  <Text>{c}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>,
      );
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    blocks.push(<Text key={`p-${blockIdx++}`} style={styles.p}>{line}</Text>);
    i++;
  }

  return blocks;
}

function WeeklyReportDoc(props: {
  compiled: ReportCompilation;
  narrativeMd: string;
  generatedAt: Date;
}) {
  const p = props.compiled.project;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>{p.code} · {p.name} — Weekly Progress Report</Text>
          <Text style={styles.meta}>
            Period {props.compiled.period.start} → {props.compiled.period.end}
            {p.department ? ` · ${p.department}` : ""} · Overall RAG <RagPill rag={p.rag} />
          </Text>
        </View>

        {renderMarkdown(props.narrativeMd)}

        <View style={styles.footer} fixed>
          <Text>JCorp PMO Platform · Confidential</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Generated ${props.generatedAt.toISOString().slice(0,16).replace("T"," ")} · Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderWeeklyReportPdf(input: {
  compiled: ReportCompilation;
  narrativeMd: string;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const doc = <WeeklyReportDoc {...input} />;
  const stream = await pdf(doc).toBlob();
  const ab = await stream.arrayBuffer();
  return new Uint8Array(ab);
}
