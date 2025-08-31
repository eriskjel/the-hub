import { MonsterStrip, MonsterStripProps } from "./monsterStrip";

export function Roller(props: MonsterStripProps) {
    return (
        <div className="relative mx-auto flex h-auto w-[640px] overflow-hidden rounded-lg border-4 bg-black py-2">
            <div className="absolute top-0 left-1/2 z-10 h-full w-1 -translate-x-1/2 transform bg-red-500" />
            <MonsterStrip {...props} />
        </div>
    );
}
