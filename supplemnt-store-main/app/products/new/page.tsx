import PageHeader from "@/components/PageHeader";
import ProductForm from "@/components/ProductForm";
import OwnerGate from "@/components/OwnerGate";

export default function NewProductPage({ searchParams }: { searchParams: { group?: string } }) {
  return (
    <OwnerGate>
      <div>
        <PageHeader showBack title="إضافة منتج جديد" />
        <ProductForm presetGroupId={searchParams.group} />
      </div>
    </OwnerGate>
  );
}
