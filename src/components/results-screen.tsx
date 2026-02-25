import { ArrowCounterClockwise, ChartLine, House, Hourglass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/math";
import type { SessionLog } from "@/lib/types";

type ResultsScreenProps = {
  latestSession: SessionLog;
  onRetry: () => void;
  onBackHome: () => void;
};

export function ResultsScreen({
  latestSession,
  onRetry,
  onBackHome
}: ResultsScreenProps) {
  const averageMs = latestSession.attempts.length === 0
    ? 0
    : Math.round(
      latestSession.attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) / latestSession.attempts.length
    );
  const accuracyRate = latestSession.attempts.length === 0
    ? 0
    : latestSession.attempts.filter((attempt) => attempt.wrongCount === 0).length / latestSession.attempts.length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>5問の結果</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hourglass size={20} weight="duotone" />
                平均回答時間
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {Math.round(averageMs / 100) / 10} 秒
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ChartLine size={20} weight="duotone" />
                正答率
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatPercent(accuracyRate)}</CardContent>
          </Card>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onBackHome}>
            <House size={18} weight="duotone" />
            ホームへ
          </Button>
          <Button onClick={onRetry}>
            <ArrowCounterClockwise size={18} weight="duotone" />
            もう1セッション
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
