import { Monster } from "../types";
import Image from "next/image";

type MonsterCardProps = {
    monster: Monster;
};

export function MonsterCard({ monster }: MonsterCardProps) {
    return (
        <div className="flex w-40 flex-shrink-0 flex-col items-center justify-center p-2">
            <Image
                src={monster.image}
                alt={monster.name}
                width={96}
                height={96}
                className="h-24 w-24 object-contain drop-shadow-lg"
            />
            <span className="mt-2 text-sm text-white">{monster.name}</span>
        </div>
    );
}
