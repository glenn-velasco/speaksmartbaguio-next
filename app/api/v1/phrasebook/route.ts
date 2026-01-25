import { NextResponse, NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { phraseBookQuerySchema, phraseBookDatabaseSchema } from "@/app/api/v1/phrasebook/schema";

const ROUTE_COLLECTION = "phrasebook";

interface PhraseBookItem {
  ilokanoWord: string;
  englishTranslation: string;
  tagalogTranslation: string;
  partOfSpeech: string;
};

export async function GET(request: NextRequest) {

  try {

    const searchParams = request.nextUrl.searchParams;

    const partOfSpeech = searchParams.get("partOfSpeech");

    const english = searchParams.get("englishTranslation");

    const ilokano = searchParams.get("ilokanoWord");

    const tagalog = searchParams.get("tagalogTranslation");

    const limit = parseInt(searchParams.get("limit") || "10");

    let query: any = adminDb.collection(ROUTE_COLLECTION);

    if (partOfSpeech) {
      
      query = query.where("partOfSpeech", "==", partOfSpeech);
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

      const item = doc.data() as PhraseBookItem;

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

    const validation = phraseBookQuerySchema.safeParse(body);

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

export async function PUT(request: NextRequest) {

  try {

    const body = await request.json();

    const validation = phraseBookDatabaseSchema.safeParse(body);

    if (!validation.success) {

      return NextResponse.json({ 
        error: validation.error.format()
       }, 
       { status: 400 }
      );
    }

    const { id, ...updateData} = validation.data;

    const docRef = adminDb.collection(ROUTE_COLLECTION).doc(id);

    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      
      return NextResponse.json({ error: "Document ID not found" }, { status: 404 });
    }

    await docRef.update({
      ilokanoWord: updateData.ilokanoWord,
      englishTranslation: updateData.englishTranslation,
      tagalogTranslation: updateData.tagalogTranslation,
      partOfSpeech: updateData.partOfSpeech
    });

    return NextResponse.json({ message: "Entry updated successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}
