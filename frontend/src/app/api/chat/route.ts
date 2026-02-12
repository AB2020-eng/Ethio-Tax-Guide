import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { prompt, pdfContext } = await req.json();

  // 1. Select the "Flash" model (Fast & Free)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", // Use the 2026 latest free model
    systemInstruction: `You are the 'Gibi-Guide' Expert.
    Use the provided PDF context to ANALYZE the user's situation.
    If the context doesn't have the answer, use your general knowledge of Ethiopian Law.
    Always provide a 'Risk Assessment' and 'Next Steps' for the user.`
  });

  // 2. Combine the PDF data with the user's question
  const fullPrompt = `
    CONTEXT FROM TAX DOCUMENTS:
    ${pdfContext}

    USER QUESTION:
    ${prompt}

    ANALYSIS:
  `;

  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  
  return new Response(JSON.stringify({ text: response.text() }));
}
