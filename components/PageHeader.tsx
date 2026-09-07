export default function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      {action}
    </div>
  );
}
