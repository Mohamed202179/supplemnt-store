import PageHeader from "@/components/PageHeader";
import ProductForm from "@/components/ProductForm";
import OwnerGate from "@/components/OwnerGate";

export default function NewProductPage() {
  return (
    <OwnerGate>
      <div>
        <PageHeader title="إضافة منتج جديد" />
        <ProductForm />
      </div>
    </OwnerGate>
  );
}
