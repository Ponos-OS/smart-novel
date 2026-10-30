import { Button } from '../../components/Button';
import { formatFileSize } from '../../utils/format-file-size';

interface NovelCoverConfirmFormProps {
  previewUrl: string | null;
  fileName: string;
  fileSize: number;
  isUploading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NovelCoverConfirmForm({
  previewUrl,
  fileName,
  fileSize,
  isUploading,
  error,
  onConfirm,
  onCancel,
}: NovelCoverConfirmFormProps) {
  return (
    <form
      className="flex flex-col gap-4 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected cover preview"
          className="h-64 w-48 flex-shrink-0 rounded-lg object-cover shadow"
        />
      )}
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div>
          <p className="break-all font-medium text-white">
            {fileName}
          </p>
          <p className="text-sm text-gray-400">
            {formatFileSize(fileSize)}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="solid"
            color="blue"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Use this cover'}
          </Button>
          <Button
            type="button"
            variant="outline"
            color="gray"
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
