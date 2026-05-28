import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return Response.json({ error: "Prompt is required" }, { status: 400 });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are BUZZ, SoftLaunch's emotionally intelligent AI companion. Be supportive, sharp, and concise.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        return Response.json({
            output: response.choices[0]?.message?.content ?? "",
        });
    } catch (error) {
        console.error("OpenAI API error:", error);
        return Response.json(
            { error: "AI generation failed" },
            { status: 500 }
        );
    }
}