import { NextResponse, NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";

const ROUTE_COLLECTION = "dictionary";

interface DictionaryItem {
  ilokanoWord: string;
  englishTranslation: string;
  tagalogTranslation: string;
  partOfSpeech: string;
  category: string;
}

const dictionaryQuerySchema = z.object({
  ilokanoWord: z.string().min(1, { error: "Ilokano word is required" }),
  englishTranslation: z.string().min(1, { error: "English translation is required" }),
  tagalogTranslation: z.string().min(1, { error: "Tagalog translation is required" }),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "phrase", "other"]).or(z.string().min(1)),
  category: z.string().min(1, { error: "Category is required" }),
});

export async function GET(request: NextRequest) {

  try {

    const searchParams = request.nextUrl.searchParams;

    const partOfSpeech = searchParams.get("partOfSpeech");

    const category = searchParams.get("category");

    const english = searchParams.get("englishTranslation");

    const ilokano = searchParams.get("ilokanoWord");

    const tagalog = searchParams.get("tagalogTranslation");

    const limit = parseInt(searchParams.get("limit") || "10");

    let query: any = adminDb.collection(ROUTE_COLLECTION);

    if (partOfSpeech) {
      
      query = query.where("partOfSpeech", "==", partOfSpeech);
    }

    if (category) {
      
      query = query.where("category", "==", category);
    }

    if (english) {
      
      query = query.where("englishTranslation", "==", english);
    }

    if (ilokano) {
      
      query = query.where("ilokanoWord", "==", ilokano);
    }

    if (tagalog) {
      
      query = query.where("tagalogTranslation", "==", tagalog);
    }

    const searchSnapshot = await query.limit(limit).get();

    if (searchSnapshot.empty) {

      return NextResponse.json({ message: "No matching entries found." }, { status: 404 });
    }

    const data = searchSnapshot.docs.map((doc: QueryDocumentSnapshot) => {

      const item = doc.data() as DictionaryItem;

      return {
        id: doc.id,
        ...item,
      };
    });

    return NextResponse.json({ data }, { status: 200 });

  } catch (error) {

    console.error("Filtering API Error:", error);
    
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

}

export async function POST(request: NextRequest) {

  try {

    const body = await request.json();

    const validation = dictionaryQuerySchema.safeParse(body);

    if (!validation.success) {

      return NextResponse.json({ 
        error: "Validation failed",
        details: validation.error.format()
       }, 
       { status: 400 }
      );
    }

    const validData = validation.data;

    const existingDocs = await adminDb.collection(ROUTE_COLLECTION)
      .where("ilokanoWord", "==", validData.ilokanoWord)
      .get();

    if (!existingDocs.empty) {

      return NextResponse.json({ error: "Ilokano Word already exists" }, { status: 409 });
    }

    const newDocRef = await adminDb.collection(ROUTE_COLLECTION).add(validData);

    return NextResponse.json({ id: newDocRef.id, ...validData }, { status: 201 });
  
  } catch (error) {

    if (error instanceof SyntaxError) {
      
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
  }

}