declare module '*.vue' {
	import { DefineComponent } from 'vue';
	const component: DefineComponent<{}, {}, any>;
	export default component;
}

declare module 'swiss-projection' {
	type Coordinates = [number, number]
	export function LV03toWGS(coords: Coordinates): Coordinates
	export function LV95toWGS(coords: Coordinates): Coordinates
	export function WGStoLV03(coords: Coordinates): Coordinates
	export function WGStoLV95(coords: Coordinates): Coordinates
}
