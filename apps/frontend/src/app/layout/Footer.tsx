export function Footer() {
  return (
    <footer className="border-t border-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} Smart Novel. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
