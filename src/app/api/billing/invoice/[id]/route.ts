import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createClient } from "@/lib/supabase/server";
import {
  derivePurchase,
  formatAmount,
  formatPurchaseDate,
} from "@/lib/billing/purchases";
import type { CreditTransaction } from "@/types";

export const runtime = "nodejs";

const SELLER = {
  name: "Landscaip",
  email: "billing@landscaip.com",
  website: "landscaip.com",
};

interface InvoiceBody {
  billTo?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: txn, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "purchase")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!txn) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as InvoiceBody;
  const billTo = (body.billTo ?? "").trim() || user.email || "Customer";

  const purchase = derivePurchase(txn as CreditTransaction);
  const pdf = await renderInvoicePdf({ purchase, billTo });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${purchase.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

interface RenderArgs {
  purchase: ReturnType<typeof derivePurchase>;
  billTo: string;
}

function renderInvoicePdf({ purchase, billTo }: RenderArgs): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 56 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PRIMARY = "#0F8000";
    const FOREGROUND = "#171717";
    const MUTED = "#737373";
    const HAIRLINE = "#E5E5E5";

    // Header — wordmark left, "INVOICE" stamp right
    doc
      .fillColor(PRIMARY)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(SELLER.name.toUpperCase(), 56, 56);

    doc
      .fillColor(FOREGROUND)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text("INVOICE", 56, 56, { align: "right" });

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(purchase.invoiceNumber, 56, 90, { align: "right" });

    // Hairline divider
    doc
      .moveTo(56, 120)
      .lineTo(556, 120)
      .strokeColor(HAIRLINE)
      .lineWidth(1)
      .stroke();

    // Meta block — issue date + amount due
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("ISSUE DATE", 56, 140, { characterSpacing: 0.5 });
    doc
      .fillColor(FOREGROUND)
      .font("Helvetica")
      .fontSize(11)
      .text(formatPurchaseDate(purchase.createdAt), 56, 156);

    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("AMOUNT PAID", 326, 140, { characterSpacing: 0.5, width: 230 });
    doc
      .fillColor(FOREGROUND)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(formatAmount(purchase.amountCents), 326, 153, { width: 230 });

    // From / Bill to columns
    const blockTop = 210;
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("FROM", 56, blockTop, { characterSpacing: 0.5 });
    doc
      .fillColor(FOREGROUND)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(SELLER.name, 56, blockTop + 16);
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(SELLER.email, 56, blockTop + 32);
    doc.text(SELLER.website, 56, blockTop + 46);

    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("BILL TO", 326, blockTop, {
        characterSpacing: 0.5,
        width: 230,
      });
    doc
      .fillColor(FOREGROUND)
      .font("Helvetica")
      .fontSize(10)
      .text(billTo, 326, blockTop + 16, {
        width: 230,
        lineGap: 2,
      });

    // Line items table — column header
    const tableTop = 320;
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("DESCRIPTION", 56, tableTop, { characterSpacing: 0.5 })
      .text("CREDITS", 386, tableTop, { width: 70, align: "right" })
      .text("AMOUNT", 466, tableTop, { width: 90, align: "right" });

    doc
      .moveTo(56, tableTop + 18)
      .lineTo(556, tableTop + 18)
      .strokeColor(HAIRLINE)
      .lineWidth(1)
      .stroke();

    const rowY = tableTop + 32;
    doc
      .fillColor(FOREGROUND)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(purchase.packName, 56, rowY);
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text("One-time credit pack", 56, rowY + 16);

    doc
      .fillColor(FOREGROUND)
      .font("Helvetica")
      .fontSize(11)
      .text(`+${purchase.credits}`, 386, rowY, { width: 70, align: "right" })
      .text(formatAmount(purchase.amountCents), 466, rowY, {
        width: 90,
        align: "right",
      });

    // Total row
    const totalY = rowY + 60;
    doc
      .moveTo(326, totalY)
      .lineTo(556, totalY)
      .strokeColor(HAIRLINE)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("TOTAL", 326, totalY + 14, {
        characterSpacing: 0.5,
        width: 130,
      });
    doc
      .fillColor(FOREGROUND)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(formatAmount(purchase.amountCents), 466, totalY + 11, {
        width: 90,
        align: "right",
      });

    // Footer
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Thanks for your business. Questions? Reply to your purchase confirmation email.",
        56,
        720,
        { align: "center", width: 500 }
      );

    doc.end();
  });
}
