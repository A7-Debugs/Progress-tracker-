import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { Camera, Trash2, Columns2 } from 'lucide-react';
import { db } from '@/lib/db';
import { newId, todayStr } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import type { PhotoAngle, ProgressPhoto } from '@/lib/types';

const ANGLES: PhotoAngle[] = ['front', 'side', 'back'];

function usePhotoUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function PhotoThumb({ photo, onDelete, onSelect, selected }: { photo: ProgressPhoto; onDelete: () => void; onSelect?: () => void; selected?: boolean }) {
  const url = usePhotoUrl(photo.blob);
  return (
    <div className={`relative rounded-xl overflow-hidden border ${selected ? 'border-accent' : 'border-base-800'} bg-base-900 aspect-[3/4]`} onClick={onSelect}>
      {url && <img src={url} className="w-full h-full object-cover" alt={`${photo.angle} ${photo.date}`} />}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <p className="text-[11px] font-medium text-white">{format(parseISO(photo.date), 'MMM d, yyyy')}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function Photos() {
  const [angle, setAngle] = useState<PhotoAngle>('front');
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = useLiveQuery(() => db.progressPhotos.orderBy('date').reverse().toArray(), []);

  const filtered = useMemo(() => (photos ?? []).filter((p) => p.angle === angle), [photos, angle]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await db.progressPhotos.add({
      id: newId(),
      date: todayStr(),
      angle,
      blob: file,
      createdAt: Date.now(),
    });
    e.target.value = '';
  }

  async function remove(id: string) {
    if (!confirm('Delete this photo?')) return;
    await db.progressPhotos.delete(id);
    setSelected((s) => s.filter((x) => x !== id));
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 2) return [s[1], id];
      return [...s, id];
    });
  }

  const comparePhotos = photos?.filter((p) => selected.includes(p.id)) ?? [];

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Progress Photos"
        back
        right={
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setCompareMode((c) => !c)} aria-label="Compare">
              <Columns2 size={18} className={compareMode ? 'text-accent' : ''} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} aria-label="Add photo">
              <Camera size={19} />
            </Button>
          </div>
        }
      />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

      <div className="px-4 pt-3 pb-24">
        <Tabs value={angle} onValueChange={(v) => setAngle(v as PhotoAngle)}>
          <TabsList className="mb-3">
            {ANGLES.map((a) => (
              <TabsTrigger key={a} value={a} className="capitalize">
                {a}
              </TabsTrigger>
            ))}
          </TabsList>

          {compareMode && comparePhotos.length === 2 && (
            <Card className="p-3 mb-3">
              <p className="text-xs text-base-400 mb-2">Comparing 2 photos</p>
              <div className="grid grid-cols-2 gap-2">
                {comparePhotos
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((p) => (
                    <PhotoThumb key={p.id} photo={p} onDelete={() => remove(p.id)} />
                  ))}
              </div>
            </Card>
          )}

          {ANGLES.map((a) => (
            <TabsContent key={a} value={a}>
              {filtered.length === 0 ? (
                <EmptyState icon={Camera} title="No photos yet" description={`Add a ${a} progress photo to start comparing.`} action={<Button onClick={() => fileInputRef.current?.click()}>Add photo</Button>} />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filtered.map((p) => (
                    <PhotoThumb
                      key={p.id}
                      photo={p}
                      selected={selected.includes(p.id)}
                      onSelect={compareMode ? () => toggleSelect(p.id) : undefined}
                      onDelete={() => remove(p.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
