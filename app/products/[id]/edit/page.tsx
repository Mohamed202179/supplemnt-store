"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Product } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import ProductForm from "@/components/ProductForm";

export default function EditProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setProduct(data as Product);
        }
      });
  }, [params.id]);

  return (
    <div>
      <PageHeader title="تعديل المنتج" />
      {notFound && <p className="p-6 text-center text-sm text-gray-400">المنتج غير موجود</p>}
      {product && <ProductForm initial={product} />}
    </div>
  );
}
