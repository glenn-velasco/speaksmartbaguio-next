import { NextResponse, NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";

interface TranslationsItem {
  english: string;
  ilokano: string;
  tagalog: string;
}

export async function GET(request: NextRequest) {

  try {

    const searchParams = request.nextUrl.searchParams;

    const english = searchParams.get("english");

    const ilokano = searchParams.get("ilokano");

    const tagalog = searchParams.get("tagalog");

    const limit = parseInt(searchParams.get("limit") || "10");

    let query: any = adminDb.collection("translations");

    if (english) {
      
      query = query.where("english", "==", english);
    }

    if (ilokano) {
      
      query = query.where("ilokano", "==", ilokano);
    }

    if (tagalog) {
      
      query = query.where("tagalog", "==", tagalog);
    }

    if (ilokano) {
      
      query = query.where("ilokano", "==", ilokano);
    }

    if (tagalog) {
      
      query = query.where("tagalog", "==", tagalog);
    }

    const searchSnapshot = await query.limit(limit).get();

    if (searchSnapshot.empty) {

      return NextResponse.json({ message: "No matching entries found." }, { status: 404 });
    }

    const data = searchSnapshot.docs.map((doc: QueryDocumentSnapshot) => {

      const item = doc.data() as TranslationsItem;

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