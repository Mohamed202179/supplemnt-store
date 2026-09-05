export default function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}
