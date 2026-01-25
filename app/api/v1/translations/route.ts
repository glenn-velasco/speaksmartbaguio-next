import { NextResponse, NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { translationsQuerySchema, translationsDatabaseSchema } from "@/app/api/v1/translations/schema";

const ROUTE_COLLECTION = "translations";

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

export async function POST(request: NextRequest) {
  
  try {

    const body = await request.json();

    const validation = translationsQuerySchema.safeParse(body);

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
      .where("ilokano", "==", validData.ilokano)
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

    const validation = translationsDatabaseSchema.safeParse(body);

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
      ilokano: updateData.ilokano,
      english: updateData.english,
      tagalog: updateData.tagalog
    });

    return NextResponse.json({ message: "Entry updated successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  
  try {

    const searchParams = request.nextUrl.searchParams;

    const id = searchParams.get("id");

    if (!id) {

      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    const docRef = adminDb.collection(ROUTE_COLLECTION).doc(id);

    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {

      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({ message: "Entry deleted successfully", id }, { status: 200 });

  } catch (error) {
    
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}