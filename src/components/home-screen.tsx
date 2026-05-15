import { GearSix } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UnitCard } from "@/lib/types";

type HomeScreenProps = {
  unitCards: UnitCard[];
  onStart: (unitId: string) => void;
  onOpenData: () => void;
  onOpenCalibration: () => void;
};

export function HomeScreen({
  unitCards,
  onStart,
  onOpenData,
  onOpenCalibration
}: HomeScreenProps) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle className="text-2xl">算数トレーニング</CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {unitCards.map((unit) => (
          <Card key={unit.id} className={unit.status === "coming_soon" ? "opacity-80" : ""}>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 pr-10 text-lg">
                {unit.title}
              </CardTitle>
              {unit.id === "angles" && unit.status === "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8"
                  onClick={onOpenCalibration}
                  aria-label="テンプレート校正を開く"
                  title="テンプレート校正"
                >
                  <GearSix size={18} />
                </Button>
              )}
            </CardHeader>
            <CardFooter className="justify-between">
              {unit.status === "active" ? (
                <Button onClick={() => onStart(unit.id)}>
                  {unit.id === "quadrilaterals" ? "観察する" : "5問を開始"}
                </Button>
              ) : (
                <Badge variant="outline">準備中</Badge>
              )}
              {unit.id === "angles" && unit.status === "active" ? (
                <Button variant="outline" onClick={onOpenData}>データを確認</Button>
              ) : (
                <Button variant="outline" disabled>
                  {unit.status === "active" ? "記録なし" : "近日追加"}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
