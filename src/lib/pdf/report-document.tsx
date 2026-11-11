import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportSnapshot } from "@/lib/report";

const RED = "#E30613";
const INK = "#1D1D1F";
const MUTED = "#6E6E73";
const LINE = "#D2D2D7";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: INK, fontFamily: "Helvetica", lineHeight: 1.35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 2 },
  pct: { fontSize: 30, fontFamily: "Helvetica-Bold", color: RED, textAlign: "right" },
  brandRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: 0.5, borderTopColor: LINE },
  brandName: { width: 90, fontFamily: "Helvetica-Bold", fontSize: 10 },
  tiles: { flexDirection: "row", gap: 3, marginRight: 12 },
  tile: { width: 20, height: 20, borderRadius: 3, color: "white", fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "center", paddingTop: 4 },
  gates: { flexDirection: "row", gap: 9, alignItems: "center", marginRight: 10 },
  diamond: { width: 8, height: 8, transform: "rotate(45deg)", borderWidth: 1 },
  cols: { flexDirection: "row", gap: 14, marginTop: 14 },
  col: { flex: 1 },
  h: { fontSize: 8, fontFamily: "Helvetica-Bold", color: RED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5, marginTop: 10 },
  item: { flexDirection: "row", gap: 5, marginBottom: 3 },
  letter: { width: 11, height: 11, borderRadius: 2, backgroundColor: RED, color: "white", fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 1.5 },
  bullet: { width: 11, color: RED, fontFamily: "Helvetica-Bold" },
  note: { marginTop: 12, padding: 10, backgroundColor: "#F5F5F7", borderRadius: 5 },
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
});

const fmt = (d: string) => d.split("-").reverse().join("/");
const tileColor = (status: string, locked: boolean) => (status === "cerrado" ? RED : status === "pendiente" || locked ? LINE : RED);

function List({ items, empty }: { items: { text: string; letter?: string | null; sub?: string | null }[]; empty: string }) {
  if (!items.length) return <Text style={s.muted}>{empty}</Text>;
  return (
    <>
      {items.map((it, i) => (
        <View key={i} style={s.item}>
          {it.letter ? <Text style={s.letter}>{it.letter}</Text> : <Text style={s.bullet}>•</Text>}
          <Text style={{ flex: 1 }}>
            {it.text}
            {it.sub ? <Text style={s.muted}> · {it.sub}</Text> : null}
          </Text>
        </View>
      ))}
    </>
  );
}

export function ReportDocument({ r }: { r: ReportSnapshot }) {
  return (
    <Document title={`Informe quincenal · ${r.project}`} author="Franquicias Exitosas">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Franquicias Exitosas · Método ESCALA®</Text>
            <Text style={s.title}>Informe quincenal</Text>
            <Text style={s.muted}>
              {r.client} · {r.project} · {fmt(r.period.start)} al {fmt(r.period.end)}
            </Text>
          </View>
          <View>
            <Text style={s.pct}>{r.overall}%</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>avance total</Text>
          </View>
        </View>

        {r.brands.map((b) => (
          <View key={b.name} style={s.brandRow}>
            <Text style={s.brandName}>{b.name}</Text>
            <View style={s.tiles}>
              {b.letters.map((l, i) => (
                <Text key={i} style={[s.tile, { backgroundColor: tileColor(l.status, l.locked), opacity: l.status === "en_curso" || l.status === "en_revision" ? 0.75 : 1 }]}>
                  {l.letter}
                </Text>
              ))}
            </View>
            <View style={s.gates}>
              {b.gates.map((g, i) => (
                <View key={i} style={[s.diamond, { backgroundColor: g.status === "superada" ? RED : "white", borderColor: g.status === "pendiente" ? LINE : RED }]} />
              ))}
            </View>
            <Text style={{ marginLeft: "auto", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{b.progress}%</Text>
          </View>
        ))}
        <Text style={[s.muted, { fontSize: 7, marginTop: 3 }]}>Rojo: completado o en curso (más claro) · gris: pendiente · rombos: puertas FRANQUICIABLE, RENTABLE, REPLICABLE, VENDIBLE y AUTÓNOMA.</Text>

        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.h}>Lo que hicimos</Text>
            <List items={r.done.slice(0, 10).map((d) => ({ text: d.title, letter: d.letter, sub: d.brand }))} empty="Sin tareas cerradas en el período." />
            <Text style={s.h}>Riesgos</Text>
            <List items={r.risks.slice(0, 5).map((t) => ({ text: t }))} empty="Sin riesgos relevantes." />
          </View>
          <View style={s.col}>
            <Text style={s.h}>Lo que sigue (15 días)</Text>
            <List items={r.next.slice(0, 10).map((d) => ({ text: d.title, letter: d.letter, sub: [d.brand, d.due && fmt(d.due)].filter(Boolean).join(" · ") }))} empty="Sin tareas con fecha en los próximos 15 días." />
            <Text style={s.h}>Decisiones pendientes de tu parte</Text>
            <List items={r.pending.slice(0, 6).map((t) => ({ text: t }))} empty="Nada pendiente. ¡Gracias!" />
          </View>
        </View>

        {r.note && (
          <View style={s.note}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Comentario del consultor</Text>
            <Text>{r.note}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>Franquicias Exitosas · Método ESCALA® — Estructura · Desarrolla · Expande</Text>
          <Text>Generado el {fmt(r.period.end)}</Text>
        </View>
      </Page>
    </Document>
  );
}
