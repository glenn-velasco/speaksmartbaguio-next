import { NextResponse, NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";

interface DictionaryItem {
  ilokanoWord: string;
  englishTranslation: string;
  tagalogTranslation: string;
  partOfSpeech: string;
  category: string;
}

export async function GET(request: NextRequest) {

  try {

    const searchParams = request.nextUrl.searchParams;

    const partOfSpeech = searchParams.get("partOfSpeech");

    const category = searchParams.get("category");

    const english = searchParams.get("englishTranslation");

    const ilokano = searchParams.get("ilokanoWord");

    const tagalog = searchParams.get("tagalogTranslation");

    const limit = parseInt(searchParams.get("limit") || "10");

    let query: any = adminDb.collection("dictionary");

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