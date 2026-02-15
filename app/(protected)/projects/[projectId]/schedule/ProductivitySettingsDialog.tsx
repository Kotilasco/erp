'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveProductivitySettings } from './actions';
import { useToast } from '@/components/ui/use-toast';
import { ArrowPathIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

type Settings = {
  builderShare: number;
  excavationBuilder: number;
  excavationAssistant: number;
  brickBuilder: number;
  brickAssistant: number;
  plasterBuilder: number;
  plasterAssistant: number;
  cubicBuilder: number;
  cubicAssistant: number;
  tilerBuilder: number;
  tilerAssistant: number;
};

export function ProductivitySettingsDialog({
  projectId,
  initialSettings,
}: {
  projectId: string;
  initialSettings: Settings;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveProductivitySettings(projectId, settings);
      toast({ title: 'Settings saved', description: 'Productivity rates updated.' });
      setOpen(false);
      // Optional: trigger revalidation or page refresh if needed, but server action usually handles revalidatePath
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof Settings, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setSettings((prev) => ({ ...prev, [key]: num }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Cog6ToothIcon className="w-4 h-4 mr-2" />
          Productivity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Productivity Settings</DialogTitle>
          <DialogDescription>
            Adjust the daily output rates for different tasks and the builder/assistant ratio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Labor Ratio</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Builder Share (0.0 - 1.0)</Label>
                <div className="text-xs text-muted-foreground mb-1">
                  e.g., 0.5 means 1 Builder : 1 Assistant. 0.33 means 1:2.
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.builderShare}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('builderShare', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Excavation (m/day)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Builder Rate</Label>
                <Input
                  type="number"
                  value={settings.excavationBuilder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('excavationBuilder', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assistant Rate</Label>
                <Input
                  type="number"
                  value={settings.excavationAssistant}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('excavationAssistant', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Brickwork (bricks/day)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Builder Rate</Label>
                <Input
                  type="number"
                  value={settings.brickBuilder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('brickBuilder', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assistant Rate</Label>
                <Input
                  type="number"
                  value={settings.brickAssistant}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('brickAssistant', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Plastering (m²/day)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Builder Rate</Label>
                <Input
                  type="number"
                  value={settings.plasterBuilder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('plasterBuilder', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assistant Rate</Label>
                <Input
                  type="number"
                  value={settings.plasterAssistant}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('plasterAssistant', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="font-semibold border-b pb-2">Tiling (m²/day)</h3>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Builder Rate</Label>
                 <Input
                   type="number"
                   value={settings.tilerBuilder}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('tilerBuilder', e.target.value)}
                 />
               </div>
               <div className="space-y-2">
                 <Label>Assistant Rate</Label>
                 <Input
                   type="number"
                   value={settings.tilerAssistant}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('tilerAssistant', e.target.value)}
                 />
               </div>
             </div>
           </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Concrete/Cubic (m³/day)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Builder Rate</Label>
                <Input
                  type="number"
                  value={settings.cubicBuilder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('cubicBuilder', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assistant Rate</Label>
                <Input
                  type="number"
                  value={settings.cubicAssistant}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('cubicAssistant', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
