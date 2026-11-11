import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const RED = "#E30613";
const INK = "#1D1D1F";
const MUTED = "#6E6E73";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, color: INK, fontFamily: "Helvetica", lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  brand: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 8.5, color: MUTED },
  tiles: { flexDirection: "row", gap: 3 },
  tile: { width: 18, height: 18, backgroundColor: RED, color: "white", fontFamily: "Helvetica-Bold", fontSize: 11, textAlign: "center", paddingTop: 3, borderRadius: 3 },
  tileOff: { backgroundColor: "#D2D2D7" },
  eyebrow: { fontSize: 8.5, color: RED, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 6, lineHeight: 1.15 },
  meta: { color: MUTED, marginBottom: 22 },
  gateRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20, padding: 12, backgroundColor: "#F5F5F7", borderRadius: 6 },
  diamond: { width: 14, height: 14, backgroundColor: RED, transform: "rotate(45deg)" },
  h: { fontSize: 9, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 4 },
  approval: { marginTop: 28, padding: 14, borderWidth: 1.5, borderColor: RED, borderRadius: 6 },
  approvalTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4 },
  pending: { marginTop: 28, padding: 14, borderWidth: 1, borderColor: "#D2D2D7", borderRadius: 6, color: MUTED },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

export type ActaData = {
  title: string;
  clientName: string;
  projectName: string;
  brandName: string;
  gateName: string;
  criterion: string;
  stepLetter: string;
  stepName: string;
  sections: { label: string; text: string }[];
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  hash: string | null;
  sentAt: string | null;
  completedLetters: number;
};

export function ActaDocument({ d }: { d: ActaData }) {
  return (
    <Document title={d.title} author="Franquicias Exitosas" subject="Acta de puerta · Método ESCALA®">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Franquicias Exitosas</Text>
            <Text style={s.sub}>Método ESCALA® · Estructura · Desarrolla · Expande</Text>
          </View>
          <View style={s.tiles}>
            {["E", "S", "C", "A", "L", "A"].map((l, i) => (
              <Text key={i} style={i < d.completedLetters ? s.tile : [s.tile, s.tileOff]}>
                {l}
              </Text>
            ))}
          </View>
        </View>

        <Text style={s.eyebrow}>Acta de puerta de decisión</Text>
        <Text style={s.title}>{d.title}</Text>
        <Text style={s.meta}>
          {d.clientName} · {d.projectName} · Marca {d.brandName}
        </Text>

        <View style={s.gateRow}>
          <View style={s.diamond} />
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>PUERTA {d.gateName.toUpperCase()}</Text>
            <Text style={{ color: MUTED }}>
              Cierra el paso {d.stepLetter} · {d.stepName}. Criterio: {d.criterion}
            </Text>
          </View>
        </View>

        {d.sections.map((sec) => (
          <View key={sec.label} wrap={false}>
            <Text style={s.h}>{sec.label}</Text>
            <Text>{sec.text}</Text>
          </View>
        ))}

        {d.status === "aprobado" ? (
          <View style={s.approval} wrap={false}>
            <Text style={s.approvalTitle}>Aprobación digital del cliente</Text>
            <Text>
              Aprobada por {d.approvedBy} el {d.approvedAt} (hora de La Paz).
            </Text>
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>Huella SHA-256 del contenido aprobado: {d.hash}</Text>
          </View>
        ) : (
          <View style={s.pending} wrap={false}>
            <Text>{d.status === "enviado" ? `Enviada para aprobación el ${d.sentAt}. Pendiente de aprobación del cliente.` : "Borrador · pendiente de envío al cliente."}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>Franquicias Exitosas · Método ESCALA® — documento propiedad de Franquicias Exitosas</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
