declare module "kitsui/utility/Type" {
    export type Falsy = false | null | undefined | 0 | 0n | '';
}
declare module "kitsui/utility/Arrays" {
    import type { Falsy } from "kitsui/utility/Type";
    export const NonNullish: <T>(value: T | null | undefined) => value is T;
    export const Truthy: <T>(value: T) => value is Exclude<T, Falsy>;
    namespace Arrays {
        type Or<T> = T | T[];
        type ReadonlyOr<T> = T | readonly T[];
        function resolve<T>(value: Or<T>): T[];
        const filterInPlace: <T>(array: T[], predicate: (value: T, index: number, array: T[]) => boolean) => T[];
        const distinctInPlace: <T>(array: T[], mapper?: (value: T) => unknown) => T[];
    }
    export default Arrays;
}
declare module "kitsui/utility/Functions" {
    export type SupplierOr<T, A extends any[] = []> = T | ((...args: A) => T);
    export type AnyFunction<R = any> = (...args: any[]) => R;
    namespace Functions {
        const NO_OP: () => void;
        function resolve<ARGS extends any[], RETURN>(fn: SupplierOr<RETURN, ARGS>, ...args: ARGS): RETURN;
        function throwing(message: string): () => never;
    }
    export default Functions;
}
declare module "kitsui/utility/Objects" {
    export type Mutable<T> = {
        -readonly [KEY in keyof T]: T[KEY];
    };
    export const mutable: <T>(value: T) => Mutable<T>;
    export type PartialRecord<K extends string, V> = Partial<Record<K, V>>;
    export const DefineProperty: <O, K extends string & keyof O>(obj: O, key: K, value: O[K]) => O[K];
    export interface MagicDefinition<O, K extends string & keyof O> {
        get(this: O): O[K];
        set?(this: O, value: O[K]): void;
    }
    export const DefineMagic: <O, K extends string & keyof O>(obj: O, key: K, definition: MagicDefinition<O, K>) => void;
    namespace Objects {
    }
    export default Objects;
}
declare module "kitsui/utility/State" {
    import Arrays from "kitsui/utility/Arrays";
    import type { SupplierOr } from "kitsui/utility/Functions";
    interface State<T, E = T> {
        readonly isState: true;
        readonly value: T;
        readonly comparator: <V extends T>(value: V) => boolean;
        id?: string;
        setId(id: string): this;
        /** Subscribe to state change events. Receive the initial state as an event. */
        use(owner: State.Owner, subscriber: (value: E, oldValue: E | undefined, owner: State.Owner) => unknown): State.Unsubscribe;
        useManual(subscriber: (value: E, oldValue: E | undefined, owner: State.Owner) => unknown): State.Unsubscribe;
        /** Subscribe to state change events. The initial state is not sent as an event. */
        subscribe(owner: State.Owner, subscriber: (value: E, oldValue?: E) => unknown): State.Unsubscribe;
        subscribeManual(subscriber: (value: E, oldValue?: E) => unknown): State.Unsubscribe;
        unsubscribe(subscriber: (value: E, oldValue?: E) => unknown): void;
        emit(oldValue?: E): void;
        match<R extends Arrays.Or<T>>(owner: State.Owner, value: R, then: (value: R extends (infer R)[] ? R : R) => unknown): State.Unsubscribe;
        matchManual<R extends Arrays.Or<T>>(value: R, then: (value: R extends (infer R)[] ? R : R) => unknown): State.Unsubscribe;
        await(owner: State.Owner, value: T): Promise<T>;
        map<R>(owner: State.Owner, mapper: (value: T) => State.Or<R>, equals?: State.ComparatorFunction<R>): State.Generator<R>;
        mapManual<R>(mapper: (value: T) => State.Or<R>, equals?: State.ComparatorFunction<R>): State.Generator<R>;
        nonNullish: State.Generator<boolean>;
        truthy: State.Generator<boolean>;
        falsy: State.Generator<boolean>;
        not: State.Generator<boolean>;
        equals(value: T): State.Generator<boolean>;
        coalesce<R>(right: State.Or<R>): State.Generator<Exclude<T, null | undefined> | R>;
        delay(owner: State.Owner, delay: SupplierOr<number, [T]>, mapper?: null, equals?: State.ComparatorFunction<T>): State<T>;
        delay<R>(owner: State.Owner, delay: SupplierOr<number, [T]>, mapper: (value: T) => State.Or<R>, equals?: State.ComparatorFunction<R>): State<R>;
        asMutable?: MutableState<T>;
    }
    interface MutableStateSimple<T> extends State<T> {
        value: T;
    }
    interface MutableState<T> extends MutableStateSimple<T> {
        setValue(value: T): this;
        bind(owner: State.Owner, state: State<T>): State.Unsubscribe;
        bindManual(state: State<T>): State.Unsubscribe;
    }
    function State<T>(defaultValue: T, comparator?: State.ComparatorFunction<T>): State.Mutable<T>;
    namespace State {
        export interface Owner {
            removed: State<boolean>;
            remove?(): void;
        }
        export namespace Owner {
            function getRemovedState(ownerIn: Owner): State<boolean>;
            function getRemovedState(ownerIn?: unknown): State<boolean> | undefined;
            interface Removable extends Owner {
                remove(): void;
            }
            function create(): Owner.Removable;
        }
        export type Mutable<T> = MutableState<T>;
        export type MutableSetOnly<T> = MutableStateSimple<T>;
        export type Or<T> = T | State<T>;
        export type MutableOr<T> = T | State.Mutable<T>;
        export type Unsubscribe = () => void;
        export type ComparatorFunction<T> = false | ((a: T, b: T) => boolean);
        export function is<T>(value: unknown): value is State<T>;
        export function get<T>(value: T | State.Mutable<T>): State.Mutable<T>;
        export function get<T>(value: T | State<T>): State<T>;
        export function value<T>(state: T | State<T>): T;
        export function getInternalValue<T>(state: T | State<T>): T;
        const SYMBOL_HAS_SUBSCRIPTIONS: unique symbol;
        export interface OwnerMetadata {
            [SYMBOL_HAS_SUBSCRIPTIONS]?: boolean;
        }
        export namespace OwnerMetadata {
            function setHasSubscriptions(owner: Owner): void;
            function hasSubscriptions(owner: Owner): boolean;
        }
        export interface Generator<T> extends State<T> {
            refresh(): this;
            regenerate(): this;
            observe(owner: Owner, ...states: (State<any> | undefined)[]): this;
            observeManual(...states: (State<any> | undefined)[]): this;
            unobserve(...states: (State<any> | undefined)[]): this;
        }
        export function Generator<T>(generate: () => State.Or<T>, equals?: ComparatorFunction<T>): Generator<T>;
        export interface JIT<T> extends State<T, () => T> {
            markDirty(): this;
            observe(...states: State<any>[]): this;
            unobserve(...states: State<any>[]): this;
        }
        export function JIT<T>(generate: (owner: Owner) => State.Or<T>): JIT<T>;
        export interface AsyncStatePending<T, D = never> {
            readonly settled: false;
            readonly value: undefined;
            readonly lastValue: T | undefined;
            readonly error: undefined;
            readonly progress: AsyncProgress<D> | undefined;
        }
        export interface AsyncStateResolved<T> {
            readonly settled: true;
            readonly value: T;
            readonly lastValue: T | undefined;
            readonly error: undefined;
            readonly progress: undefined;
        }
        export interface AsyncStateRejected<T> {
            readonly settled: true;
            readonly value: undefined;
            readonly lastValue: T | undefined;
            readonly error: Error;
            readonly progress: undefined;
        }
        export type AsyncState<T, D = never> = AsyncStatePending<T, D> | AsyncStateResolved<T> | AsyncStateRejected<T>;
        export interface AsyncProgress<D> {
            readonly progress: number;
            readonly details?: D;
        }
        interface AsyncBase<T, D = never> extends State<T | undefined> {
            readonly settled: State<boolean>;
            readonly lastValue: State<T | undefined>;
            readonly error: State<Error | undefined>;
            readonly state: State<AsyncState<T, D>>;
            readonly progress: State<AsyncProgress<D> | undefined>;
        }
        export interface Async<T> extends AsyncBase<T> {
            readonly promise: Promise<T>;
        }
        export type AsyncGenerator<FROM, T, D = never> = (value: FROM, signal: AbortSignal, setProgress: (progress: number, details?: D) => void) => Promise<T>;
        export function Async<FROM, T, D = never>(owner: State.Owner, from: State<FROM>, generator: AsyncGenerator<FROM, T, D>): Async<T>;
        export interface EndpointResult<T> extends Async<T> {
            refresh(): void;
        }
        export interface ArrayItem<T> {
            value: T;
            index: number;
            removed: State<boolean>;
        }
        export interface ArraySubscriber<T> {
            onItem(item: State<ArrayItem<T>>, state: Array<T>): unknown;
            onMove(startIndex: number, endIndex: number, newStartIndex: number): unknown;
            onMoveAt(indices: number[], newStartIndex: number): unknown;
        }
        export interface Array<T> extends State<readonly T[]> {
            readonly length: State<number>;
            set(index: number, value: T): this;
            emitItem(index: number): this;
            modify(index: number, modifier: (value: T, index: number, array: this) => T | void): this;
            clear(): this;
            push(...values: T[]): this;
            unshift(...values: T[]): this;
            pop(): this;
            shift(): this;
            splice(start: number, deleteCount: number, ...values: T[]): this;
            filterInPlace(predicate: (value: T, index: number) => boolean): this;
            move(startIndex: number, endIndex: number, newStartIndex: number): this;
            moveAt(indices: number[], newStartIndex: number): this;
            useEach(owner: State.Owner, subscriber: ArraySubscriber<T>): State.Unsubscribe;
        }
        export function Array<T>(...values: T[]): Array<T>;
        export function Truthy(owner: Owner, state: State<any>): Generator<boolean>;
        export function NonNullish(owner: Owner, state: State<any>): Generator<boolean>;
        export function Falsy(owner: Owner, state: State<any>): Generator<boolean>;
        export function Some(owner: Owner, ...anyOfStates: State<unknown>[]): Generator<boolean>;
        export function Every(owner: Owner, ...anyOfStates: State<unknown>[]): Generator<boolean>;
        export function Map<const INPUT extends (State<unknown> | undefined)[], OUTPUT>(owner: Owner, inputs: INPUT, outputGenerator: (...inputs: NoInfer<{
            [I in keyof INPUT]: INPUT[I] extends State<infer INPUT> ? INPUT : undefined;
        }>) => State.Or<OUTPUT>, equals?: ComparatorFunction<NoInfer<OUTPUT>>): Generator<OUTPUT>;
        export function MapManual<const INPUT extends (State<unknown> | undefined)[], OUTPUT>(inputs: INPUT, outputGenerator: (...inputs: NoInfer<{
            [I in keyof INPUT]: Exclude<INPUT[I], undefined> extends State<infer INPUT> ? INPUT : undefined;
        }>) => State.Or<OUTPUT>, equals?: ComparatorFunction<NoInfer<OUTPUT>>): Generator<OUTPUT>;
        export function Use<const INPUT extends Record<string, (State<unknown> | undefined)>>(owner: Owner, input: INPUT): Generator<{
            [KEY in keyof INPUT]: INPUT[KEY] extends State<infer INPUT, infer OUTPUT> ? INPUT : INPUT[KEY] extends State<infer INPUT, infer OUTPUT> | undefined ? INPUT | undefined : undefined;
        }>;
        export function UseManual<const INPUT extends Record<string, (State<unknown> | undefined)>>(input: INPUT): Generator<{
            [KEY in keyof INPUT]: INPUT[KEY] extends State<infer INPUT, infer OUTPUT> ? INPUT : INPUT[KEY] extends State<infer INPUT, infer OUTPUT> | undefined ? INPUT | undefined : undefined;
        }>;
        export {};
    }
    export default State;
}
declare module "kitsui/component/Label" {
    import Component from "kitsui/Component";
    import State from "kitsui/utility/State";
    interface LabelExtensions {
        readonly textWrapper: Component;
        readonly for: State.Mutable<string | undefined>;
        readonly required: State.Mutable<boolean>;
        readonly invalid: State<boolean>;
        setTarget(target?: LabelTarget): this;
        setFor(targetName?: string): this;
        setRequired(required?: boolean | State<boolean>): this;
    }
    interface Label extends Component, LabelExtensions {
    }
    const Label: Component.Builder<[], Label>;
    export default Label;
    interface LabelTargetExtensions {
        readonly required?: State.Mutable<boolean>;
        readonly invalid?: State<boolean>;
        readonly touched?: State<boolean>;
    }
    export interface LabelTarget extends Component, LabelTargetExtensions {
    }
    export const LabelTarget: Component.Extension<[], Component<HTMLElement>>;
}
declare module "kitsui/utility/Vector2" {
    import type { Mutable } from "kitsui/utility/Objects";
    interface Vector2 {
        readonly x: number;
        readonly y: number;
    }
    function Vector2(): Vector2;
    function Vector2(xy: number): Vector2;
    function Vector2(x: number, y: number): Vector2;
    namespace Vector2 {
        const ZERO: Vector2;
        const ONE: Vector2;
        function mutable(): Mutable<Vector2>;
        function mutable(xy: number): Mutable<Vector2>;
        function mutable(x: number, y: number): Mutable<Vector2>;
        function fromClient(clientSource: {
            clientX: number;
            clientY: number;
        }): Vector2;
        function equals(v1: Vector2, v2: Vector2): boolean;
        function distance(v1: Vector2, v2: Vector2): number;
        function distanceWithin(within: number, v1: Vector2, v2: Vector2): boolean;
        function add(v1: Vector2, v2: Vector2): Vector2;
        function addInPlace(v1: Mutable<Vector2>, v2: Vector2): Mutable<Vector2>;
        function subtract(v1: Vector2, v2: Vector2): Vector2;
        function subtractInPlace(v1: Mutable<Vector2>, v2: Vector2): Mutable<Vector2>;
        function multiply(v: Vector2, scalar: number): Vector2;
        function multiplyInPlace(v: Mutable<Vector2>, scalar: number): Mutable<Vector2>;
        function divide(v: Vector2, scalar: number): Vector2;
        function divideInPlace(v: Mutable<Vector2>, scalar: number): Mutable<Vector2>;
        function modTruncate(v: Vector2, scalar: number): Vector2;
        function modTruncateInPlace(v: Mutable<Vector2>, scalar: number): Mutable<Vector2>;
        function modFloor(v: Vector2, scalar: number): Vector2;
        function modFloorInPlace(v: Mutable<Vector2>, scalar: number): Mutable<Vector2>;
        function dot(v1: Vector2, v2: Vector2): number;
        /** IE, distance from 0,0 */
        function magnitude(v: Vector2): number;
        function normalise(v: Vector2): Vector2;
        function normaliseInPlace(v: Mutable<Vector2>): Mutable<Vector2>;
        function angle(v1: Vector2, v2: Vector2): number;
        function rotate(v: Vector2, angle: number): Vector2;
        function rotateInPlace(v: Mutable<Vector2>, angle: number): Mutable<Vector2>;
        function lerp(v1: Vector2, v2: Vector2, t: number): Vector2;
        function clamp(v: Vector2, min: Vector2, max: Vector2): Vector2;
        function clampInPlace(v: Mutable<Vector2>, min: Vector2, max: Vector2): Mutable<Vector2>;
    }
    export default Vector2;
}
declare module "kitsui/utility/Mouse" {
    import State from "kitsui/utility/State";
    import type Vector2 from "kitsui/utility/Vector2";
    namespace Mouse {
        const state: State<Vector2>;
        type MouseMoveHandler = (mouse: Vector2) => unknown;
        function onMove(handler: MouseMoveHandler): void;
        function offMove(handler: MouseMoveHandler): void;
        function listen(): void;
    }
    export default Mouse;
}
declare module "kitsui/utility/Strings" {
    export type UUID = `${string}-${string}-${string}-${string}-${string}`;
    namespace Strings {
        /**
         * Generates a unique string valid for an ID on an element, in the format `_<base 36 timestamp><base 36 random number>`
         * For example: `_m6rpr4mo02bw589br2ze`
         */
        function uid(): string;
        function simplify(string: string): string;
        function areSameWords(a?: string, b?: string): boolean;
        type Replace<STRING extends string, MATCH extends string, REPLACE extends string> = STRING extends `${infer A}${MATCH}${infer B}` ? `${Replace<A, MATCH, REPLACE>}${REPLACE}${Replace<B, MATCH, REPLACE>}` : STRING;
        function includesAt(string: string, substring: string, index: number): boolean;
        function splitOnce(string: string, separator: string): string[];
        function sliceTo(string: string, substring: string, startAt?: number): string;
        function sliceAfter(string: string, substring: string, startAt?: number): string;
        function trimTextMatchingFromStart(string: string, substring: string, startAt?: number): string;
        function trimTextMatchingFromEnd(string: string, substring: string, startAt?: number): string;
        function extractFromQuotes(string?: string | null): string;
        function extractFromSquareBrackets(string?: string | null): string;
        function mergeRegularExpressions(flags: string, ...expressions: RegExp[]): RegExp;
        function count(string: string, substring: string, stopAtCount?: number): number;
        function includesOnce(string: string, substring: string): boolean;
        function getVariations(name: string): string[];
        function shiftLine(lines: string, count?: number): string;
    }
    export default Strings;
}
declare module "kitsui/utility/Time" {
    namespace Time {
        type ISO = `${bigint}-${bigint}-${bigint}T${bigint}:${bigint}:${number}Z`;
        function floor(interval: number): number;
        const frame: number;
        function ms(ms: number): number;
        function seconds(seconds: number): number;
        function minutes(minutes: number): number;
        function hours(hours: number): number;
        function days(days: number): number;
        function weeks(weeks: number): number;
        function months(months: number): number;
        function years(years: number): number;
        function decades(decades: number): number;
        function centuries(centuries: number): number;
        function millenia(millenia: number): number;
        interface RelativeOptions extends Intl.RelativeTimeFormatOptions {
            components?: number;
            /** Only show seconds if not showing another component */
            secondsExclusive?: true;
            label?: boolean;
        }
        function relative(unixTimeMs: number, options?: RelativeOptions): string;
        function absolute(ms: number, options?: Intl.DateTimeFormatOptions): string;
    }
    export default Time;
}
declare module "kitsui/utility/Task" {
    export default class Task {
        private readonly interval;
        static yield(instantIfUnsupported?: boolean): Promise<void>;
        static post<T>(callback: () => Promise<T>, priority: 'user-blocking' | 'user-visible' | 'background'): Promise<T>;
        private lastYieldEnd;
        constructor(interval?: number);
        reset(): void;
        yield(instantIfUnsupported?: boolean): Promise<void>;
    }
}
declare module "kitsui/utility/Style" {
    import State from "kitsui/utility/State";
    namespace Style {
        const properties: State.JIT<CSSStyleDeclaration>;
        function measure(property: string): State<number>;
        function reload(path: string): Promise<void>;
    }
    export default Style;
}
declare module "kitsui/utility/Viewport" {
    import State from "kitsui/utility/State";
    namespace Viewport {
        interface Size {
            w: number;
            h: number;
        }
        const size: State.JIT<Size>;
        const mobile: State.JIT<boolean>;
        const tablet: State.JIT<boolean>;
        const laptop: State.JIT<boolean>;
        type State = 'desktop' | 'laptop' | 'tablet' | 'mobile';
        const state: State.JIT<"desktop" | "laptop" | "tablet" | "mobile">;
        function listen(): void;
    }
    export default Viewport;
}
declare module "kitsui/utility/AnchorManipulator" {
    import type Component from "kitsui/Component";
    import State from "kitsui/utility/State";
    export const ANCHOR_TYPES: readonly ["off", "aligned"];
    export type AnchorType = (typeof ANCHOR_TYPES)[number];
    export const ANCHOR_SIDE_HORIZONTAL: readonly ["left", "right"];
    export type AnchorSideHorizontal = (typeof ANCHOR_SIDE_HORIZONTAL)[number];
    export const ANCHOR_SIDE_VERTICAL: readonly ["top", "bottom"];
    export type AnchorSideVertical = (typeof ANCHOR_SIDE_VERTICAL)[number];
    export type AnchorOffset = `+${number}` | `-${number}`;
    export type AnchorStringHorizontalSimple = `${AnchorType} ${AnchorSideHorizontal}` | 'centre';
    export type AnchorStringHorizontal = `${'sticky ' | ''}${AnchorStringHorizontalSimple}${'' | ` ${AnchorOffset}`}`;
    export type AnchorStringVerticalSimple = `${AnchorType} ${AnchorSideVertical}` | 'centre';
    export type AnchorStringVertical = `${'sticky ' | ''}${AnchorStringVerticalSimple}${'' | ` ${AnchorOffset}`}`;
    export type AnchorStringSimple = AnchorStringHorizontalSimple | AnchorStringVerticalSimple;
    export type AnchorString = AnchorStringHorizontal | AnchorStringVertical;
    export interface AnchorLocationPreference {
        xAnchor: AnchorLocationHorizontal;
        xRefSelector: string;
        yAnchor: AnchorLocationVertical;
        yRefSelector: string;
        options?: AnchorLocationPreferenceOptions;
    }
    export interface AnchorLocationPreferenceOptions {
        allowXOffscreen?: true;
        allowYOffscreen?: true;
        xValid?(x: number, hostBox: DOMRect | undefined, anchoredBox: DOMRect): boolean;
        yValid?(y: number, hostBox: DOMRect | undefined, anchoredBox: DOMRect): boolean;
    }
    export interface AnchorLocationHorizontal {
        type: AnchorType | 'centre';
        side: AnchorSideHorizontal | 'centre';
        sticky: boolean;
        offset: number;
    }
    export interface AnchorLocationVertical {
        type: AnchorType | 'centre';
        side: AnchorSideVertical | 'centre';
        sticky: boolean;
        offset: number;
    }
    export const ANCHOR_LOCATION_ALIGNMENTS: readonly ["left", "centre", "right"];
    export type AnchorLocationAlignment = (typeof ANCHOR_LOCATION_ALIGNMENTS)[number];
    export interface AnchorLocation {
        x: number;
        y: number;
        mouse: boolean;
        padX: boolean;
        alignment?: AnchorLocationAlignment;
        xRefBox?: DOMRect;
        yRefBox?: DOMRect;
        preference?: AnchorLocationPreference;
    }
    export const AllowYOffscreen: AnchorLocationPreferenceOptions;
    export const AllowXOffscreen: AnchorLocationPreferenceOptions;
    interface AnchorManipulator<HOST> {
        readonly state: State<AnchorLocation | undefined>;
        isMouse(): boolean;
        /** Reset the location preference for this anchor */
        reset(): HOST;
        from(component: Component): HOST;
        /**
         * Add a location fallback by defining an x and y anchor on the source component.
         */
        add(xAnchor: AnchorStringHorizontal, yAnchor: AnchorStringVertical, options?: AnchorLocationPreferenceOptions): HOST;
        /**
         * Add a location fallback by defining an x anchor on a selected ancestor component (or descendant when prefixed with `>>`), and a y anchor on the source component.
         */
        add(xAnchor: AnchorStringHorizontal, xRefSelector: string, yAnchor: AnchorStringVertical, options?: AnchorLocationPreferenceOptions): HOST;
        /**
         * Add a location fallback by defining an x anchor on the source component, and a y anchor on a selected ancestor component (or descendant when prefixed with `>>`)
         */
        add(xAnchor: AnchorStringHorizontal, yAnchor: AnchorStringVertical, yRefSelector: string, options?: AnchorLocationPreferenceOptions): HOST;
        /**
         * Add a location fallback by defining x and y anchors on selected ancestor components (or descendants when prefixed with `>>`)
         */
        add(xAnchor: AnchorStringHorizontal, xRefSelector: string, yAnchor: AnchorStringVertical, yRefSelector: string, options?: AnchorLocationPreferenceOptions): HOST;
        /** Rather than anchoring on the mouse when all other fallbacks are invalid, hides the anchored element entirely */
        orElseHide(): HOST;
        /**
         * Marks the anchor positioning "dirty", causing it to be recalculated from scratch on next poll
         */
        markDirty(): HOST;
        get(): AnchorLocation;
        apply(): HOST;
    }
    function AnchorManipulator<HOST extends Component>(host: HOST): AnchorManipulator<HOST>;
    export default AnchorManipulator;
}
declare module "kitsui/utility/Maps" {
    namespace Maps {
        function compute<K, V>(map: Map<K, V>, key: K, computer: (key: K) => V): V;
    }
    export default Maps;
}
declare module "kitsui/utility/StringApplicator" {
    import type { SupplierOr } from "kitsui/utility/Functions";
    import State from "kitsui/utility/State";
    export interface StringApplicatorSources {
        string: string;
    }
    export interface StringApplicatorSourceDefinition<SOURCE extends keyof StringApplicatorSources = keyof StringApplicatorSources> {
        requiredState?: State<unknown>;
        match(value: unknown): value is StringApplicatorSources[SOURCE];
        toString(value: StringApplicatorSources[SOURCE]): string;
        toNodes(value: StringApplicatorSources[SOURCE]): Node[];
    }
    export type StringApplicatorSource = SupplierOr<StringApplicatorSources[keyof StringApplicatorSources]>;
    export namespace StringApplicatorSource {
        const REGISTRY: Partial<Record<keyof StringApplicatorSources, StringApplicatorSourceDefinition>>;
        function register<SOURCE extends keyof StringApplicatorSources>(source: SOURCE, value: StringApplicatorSourceDefinition): void;
        function toString(source: StringApplicatorSource): string;
        function toNodes(source: StringApplicatorSource): Node[];
        function apply(applicator: (source?: Exclude<StringApplicatorSource, Function> | null) => unknown, source?: StringApplicatorSource | null): (() => void) | undefined;
    }
    interface StringApplicator<HOST> {
        readonly state: State<string>;
        set(value: StringApplicatorSource): HOST;
        bind(state: State<StringApplicatorSource>): HOST;
        unbind(): HOST;
        /** Create a new string applicator with the same target that returns a different host */
        rehost<NEW_HOST>(newHost: NEW_HOST): StringApplicator<NEW_HOST>;
    }
    function StringApplicator<HOST>(host: HOST, apply: (value?: string) => unknown): StringApplicator.Optional<HOST>;
    function StringApplicator<HOST>(host: HOST, defaultValue: string, apply: (value: string) => unknown): StringApplicator<HOST>;
    namespace StringApplicator {
        interface Optional<HOST> extends Omit<StringApplicator<HOST>, 'state' | 'set' | 'bind' | 'rehost'> {
            state: State<string | undefined | null>;
            set(value?: StringApplicatorSource | null): HOST;
            bind(state?: State.Or<StringApplicatorSource | undefined | null>): HOST;
            /** Create a new string applicator with the same target that returns a different host */
            rehost<NEW_HOST>(newHost: NEW_HOST): StringApplicator.Optional<NEW_HOST>;
        }
        function render(content?: StringApplicatorSource | null): Node[];
        function Nodes<HOST>(host: HOST, apply: (nodes: Node[]) => unknown): StringApplicator.Optional<HOST>;
        function Nodes<HOST>(host: HOST, defaultValue: string, apply: (nodes: Node[]) => unknown): StringApplicator<HOST>;
    }
    export default StringApplicator;
}
declare module "kitsui/utility/AttributeManipulator" {
    import type Component from "kitsui/Component";
    import State from "kitsui/utility/State";
    import { StringApplicatorSource } from "kitsui/utility/StringApplicator";
    interface AttributeManipulator<HOST> {
        has(attribute: string): boolean;
        get(attribute: string): State<string | undefined>;
        /** Adds the given attributes with no values */
        append(...attributes: string[]): HOST;
        /**
         * Adds the given attributes with no values.
         * Note that prepending attributes requires removing all previous attributes, then re-appending them after.
         */
        prepend(...attributes: string[]): HOST;
        /**
         * Inserts the given attributes before the reference attribute with no values.
         * Note that inserting attributes requires removing all previous attributes, then re-appending them after.
         */
        insertBefore(referenceAttribute: string, ...attributes: string[]): HOST;
        /**
         * Inserts the given attributes after the reference attribute with no values.
         * Note that inserting attributes requires removing all previous attributes, then re-appending them after.
         */
        insertAfter(referenceAttribute: string, ...attributes: string[]): HOST;
        /** Sets the attribute to `value`, or removes the attribute if `value` is `undefined` */
        set(attribute: string, value?: string): HOST;
        bind(state: State<boolean>, attribute: string, value?: string, orElse?: string): HOST;
        bind(attribute: string, state: State<string | undefined>): HOST;
        /**
         * If the attribute is already set, does nothing.
         * Otherwise, calls the supplier, and sets the attribute to the result, or removes the attribute if it's `undefined`
         */
        compute(attribute: string, supplier: (host: HOST) => string | undefined): HOST;
        use(attribute: string, source: StringApplicatorSource): HOST;
        getUsing(attribute: string): StringApplicatorSource | undefined;
        remove(...attributes: string[]): HOST;
        toggle(present: boolean, attribute: string, value?: string): HOST;
        copy(component: Component): HOST;
        copy(element: HTMLElement): HOST;
    }
    function AttributeManipulator(component: Component): AttributeManipulator<Component>;
    export default AttributeManipulator;
}
declare module "kitsui/utility/ClassManipulator" {
    import type Component from "kitsui/Component";
    interface ClassManipulator<HOST> {
        has(...classes: string[]): boolean;
        some(...classes: string[]): boolean;
        add(...classes: string[]): HOST;
        remove(...classes: string[]): HOST;
        toggle(present: boolean, ...classes: string[]): HOST;
        copy(component: Component): HOST;
        copy(element: HTMLElement): HOST;
    }
    function ClassManipulator(component: Component): ClassManipulator<Component>;
    export default ClassManipulator;
}
declare module "kitsui/utility/EventManipulator" {
    import type Component from "kitsui/Component";
    import Arrays from "kitsui/utility/Arrays";
    import State from "kitsui/utility/State";
    interface EventExtensions<HOST> {
        host: HOST;
        targetComponent: Component | undefined;
    }
    type EventParameters<HOST, EVENTS, EVENT extends keyof EVENTS> = EVENTS[EVENT] extends (...params: infer PARAMS) => unknown ? PARAMS extends [infer EVENT extends Event, ...infer PARAMS] ? [EVENT & EventExtensions<HOST>, ...PARAMS] : [Event & EventExtensions<HOST>, ...PARAMS] : never;
    type EventParametersEmit<EVENTS, EVENT extends keyof EVENTS> = EVENTS[EVENT] extends (...params: infer PARAMS) => unknown ? PARAMS extends [Event, ...infer PARAMS] ? PARAMS : PARAMS : never;
    type EventResult<EVENTS, EVENT extends keyof EVENTS> = EVENTS[EVENT] extends (...params: any[]) => infer RESULT ? RESULT : never;
    export type EventHandler<HOST, EVENTS, EVENT extends keyof EVENTS> = (...params: EventParameters<HOST, EVENTS, EVENT>) => EventResult<EVENTS, EVENT>;
    type ResolveEvent<EVENT extends Arrays.Or<PropertyKey>> = EVENT extends PropertyKey[] ? EVENT[number] : EVENT;
    interface EventManipulatorSubscribe<HOST, EVENTS extends Record<string, any>> {
        subscribe<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST;
        subscribeCapture<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST;
        subscribePassive<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST;
    }
    interface EventManipulatorUntilSubscribe<HOST, EVENTS extends Record<string, any>> {
        subscribe<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): this;
        subscribeCapture<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): this;
        subscribePassive<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): this;
    }
    interface EventManipulator<HOST, EVENTS extends Record<string, any>> extends EventManipulatorSubscribe<HOST, EVENTS> {
        emit<EVENT extends keyof EVENTS>(event: EVENT, ...params: EventParametersEmit<EVENTS, EVENT>): EventResult<EVENTS, EVENT>[] & {
            defaultPrevented: boolean;
            stoppedPropagation: boolean | 'immediate';
        };
        bubble<EVENT extends keyof EVENTS>(event: EVENT, ...params: EventParametersEmit<EVENTS, EVENT>): EventResult<EVENTS, EVENT>[] & {
            defaultPrevented: boolean;
            stoppedPropagation: boolean | 'immediate';
        };
        unsubscribe<EVENT extends Arrays.Or<keyof EVENTS>>(event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST;
        until(owner: State.Owner, initialiser: (until: EventManipulatorUntilSubscribe<HOST, EVENTS>) => unknown): HOST;
    }
    export type NativeEvents = {
        [KEY in keyof HTMLElementEventMap]: (event: KEY extends 'toggle' ? ToggleEvent : HTMLElementEventMap[KEY]) => unknown;
    };
    export type Events<HOST, EXTENSIONS extends Record<string, any>> = HOST extends {
        event: EventManipulator<any, infer EVENTS>;
    } ? (keyof EXTENSIONS extends never ? EVENTS : (Lowercase<keyof EXTENSIONS & string> extends keyof EXTENSIONS ? 'Custom events contain at least one uppercase letter' : {
        [KEY in keyof EVENTS | keyof EXTENSIONS]: KEY extends keyof EVENTS ? KEY extends keyof EXTENSIONS ? EVENTS[KEY] & EXTENSIONS[KEY] : EVENTS[KEY] : KEY extends keyof EXTENSIONS ? EXTENSIONS[KEY] : never;
    })) : never;
    function EventManipulator<T extends object>(host: T): EventManipulator<T, NativeEvents>;
    export default EventManipulator;
}
declare module "kitsui/utility/FocusListener" {
    import type Component from "kitsui/Component";
    import State from "kitsui/utility/State";
    namespace FocusListener {
        const hasFocus: State.Mutable<boolean>;
        const focused: State.Mutable<Element | undefined>;
        const focusedLast: State.Mutable<Element | undefined>;
        function focusedComponent(): Component | undefined;
        function focus(element: HTMLElement): void;
        function blur(element: HTMLElement): void;
        function listen(): void;
    }
    export default FocusListener;
}
declare module "kitsui/utility/TextManipulator" {
    import type Component from "kitsui/Component";
    import StringApplicator from "kitsui/utility/StringApplicator";
    interface TextManipulator<HOST> extends Omit<StringApplicator.Optional<HOST>, 'rehost'> {
        prepend(text: string): HOST;
        append(text: string): HOST;
        rehost<COMPONENT extends Component>(component: COMPONENT): TextManipulator<COMPONENT>;
    }
    function TextManipulator(component: Component, target?: Component<HTMLElement>): TextManipulator<Component>;
    export default TextManipulator;
}
declare module "kitsui/Component" {
    import AnchorManipulator from "kitsui/utility/AnchorManipulator";
    import AttributeManipulator from "kitsui/utility/AttributeManipulator";
    import ClassManipulator from "kitsui/utility/ClassManipulator";
    import type { NativeEvents } from "kitsui/utility/EventManipulator";
    import EventManipulator from "kitsui/utility/EventManipulator";
    import type { Mutable } from "kitsui/utility/Objects";
    import State from "kitsui/utility/State";
    import StringApplicator from "kitsui/utility/StringApplicator";
    import TextManipulator from "kitsui/utility/TextManipulator";
    import type { Falsy } from "kitsui/utility/Type";
    const SYMBOL_COMPONENT_BRAND: unique symbol;
    export interface ComponentBrand<TYPE extends string> {
        [SYMBOL_COMPONENT_BRAND]: TYPE;
    }
    type AriaRole = 'button' | 'checkbox' | 'form' | 'main' | 'navigation' | 'toolbar' | 'textbox' | 'group' | 'radio' | 'radiogroup' | 'tablist' | 'tab' | 'tabpanel';
    global {
        interface Node {
            component?: Component;
        }
    }
    export interface ComponentInsertionDestination {
        readonly isInsertionDestination: true;
        append(...contents: (Component | Node | Falsy)[]): this;
        prepend(...contents: (Component | Node | Falsy)[]): this;
        insert(direction: 'before' | 'after', sibling: Component | Element | undefined, ...contents: (Component | Node | Falsy)[]): this;
    }
    export namespace ComponentInsertionDestination {
        function is(value: unknown): value is ComponentInsertionDestination;
    }
    export interface ComponentEvents extends NativeEvents {
        insert(): any;
        ancestorInsert(): any;
        ancestorScroll(): any;
        descendantInsert(): any;
        descendantRemove(): any;
        childrenInsert(nodes: Node[]): any;
        ancestorRectDirty(): any;
        root(): any;
        unroot(): any;
    }
    export interface ComponentExtensions<ELEMENT extends HTMLElement = HTMLElement> {
    }
    interface BaseComponent<ELEMENT extends HTMLElement = HTMLElement> extends ComponentInsertionDestination {
        readonly isComponent: true;
        readonly supers: State<any[]>;
        readonly classes: ClassManipulator<this>;
        readonly attributes: AttributeManipulator<this>;
        readonly event: EventManipulator<this, ComponentEvents>;
        readonly text: TextManipulator<this>;
        readonly anchor: AnchorManipulator<this>;
        readonly nojit: Partial<this>;
        readonly hovered: State<boolean>;
        readonly hoveredTime: State<number | undefined>;
        readonly focused: State<boolean>;
        readonly focusedTime: State<number | undefined>;
        readonly hasFocused: State<boolean>;
        readonly hasFocusedTime: State<number | undefined>;
        readonly hadFocusedLast: State<boolean>;
        readonly hoveredOrFocused: State<boolean>;
        readonly hoveredOrFocusedTime: State<number | undefined>;
        readonly hoveredOrHasFocused: State<boolean>;
        readonly hoveredOrHasFocusedTime: State<number | undefined>;
        readonly active: State<boolean>;
        readonly activeTime: State<number | undefined>;
        readonly rooted: State<boolean>;
        readonly removed: State<boolean>;
        readonly id: State<string | undefined>;
        readonly name: State<string | undefined>;
        readonly rect: State.JIT<DOMRect>;
        readonly tagName: Uppercase<keyof HTMLElementTagNameMap>;
        readonly element: ELEMENT;
        readonly fullType: string;
        /** Causes this element to be removed when its owner is removed */
        setOwner(owner: State.Owner | undefined): this;
        setId(id?: string | State<string | undefined>): this;
        setRandomId(): this;
        setName(name?: string | State<string | undefined>): this;
        is<BUILDERS extends Component.BuilderLike[]>(builder: BUILDERS): this is {
            [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never;
        }[number];
        is<COMPONENT extends Component>(builder: Component.BuilderLike<any[], COMPONENT>): this is COMPONENT;
        is<COMPONENT extends Component>(builder?: Component.BuilderLike<any[], COMPONENT>): boolean;
        as<COMPONENT extends Component>(builder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined;
        as<COMPONENT extends Component>(builder?: Component.BuilderLike<any[], COMPONENT>): COMPONENT | this | undefined;
        cast<COMPONENT extends Component>(): this & Partial<COMPONENT>;
        /**
         * **Warning:** Replacing an element will leave any subscribed events on the original element, and not re-subscribe them on the new element.
         */
        replaceElement(elementOrType: HTMLElement | keyof HTMLElementTagNameMap, keepContent?: true): this;
        and<PARAMS extends any[], COMPONENT extends Component>(builder: Component.BuilderAsync<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): Promise<this & COMPONENT>;
        and<PARAMS extends any[], COMPONENT extends Component>(builder: Component.ExtensionAsync<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): Promise<this & COMPONENT>;
        and<PARAMS extends any[], COMPONENT extends Component>(builder: Component.Builder<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): this & COMPONENT;
        and<PARAMS extends any[], COMPONENT extends Component>(builder: Component.Extension<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): this & COMPONENT;
        extend<T>(extensionProvider: (component: this & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): this & T;
        extendMagic<K extends Exclude<keyof this, symbol>, O extends this = this>(property: K, magic: (component: this) => {
            get(): O[K];
            set?(value: O[K]): void;
        }): this;
        extendJIT<K extends Exclude<keyof this, symbol>, O extends this = this>(property: K, supplier: (component: this) => O[K]): this;
        override<K extends keyof this>(property: K, provider: (component: this, original: this[K]) => this[K]): this;
        tweakJIT<PARAMS extends any[], K extends Exclude<keyof this, symbol>, O extends this = this>(property: K, tweaker: (value: O[K], component: this) => unknown): this;
        tweak<PARAMS extends any[]>(tweaker?: (component: this, ...params: PARAMS) => unknown, ...params: PARAMS): this;
        disableInsertion(): Omit<this, keyof ComponentInsertionDestination>;
        appendTo(destination: ComponentInsertionDestination | Element): this;
        prependTo(destination: ComponentInsertionDestination | Element): this;
        insertTo(destination: ComponentInsertionDestination | Element, direction: 'before' | 'after', sibling?: Component | Element): this;
        closest<BUILDERS extends Component.BuilderLike[]>(builder: BUILDERS): {
            [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never;
        }[number];
        closest<BUILDER extends Component.BuilderLike>(builder: BUILDER): (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined;
        closest<COMPONENT extends Component>(builder: Component.Builder<any[], COMPONENT>): COMPONENT | undefined;
        closest<COMPONENT extends Component>(builder: Component.Extension<any[], COMPONENT>): COMPONENT | undefined;
        getStateForClosest<BUILDERS extends Component.BuilderLike[]>(builder: BUILDERS): State.JIT<{
            [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never;
        }[number]>;
        getStateForClosest<BUILDER extends Component.BuilderLike>(builder: BUILDER): State.JIT<(BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined>;
        getStateForClosest<COMPONENT extends Component>(builder: Component.Builder<any[], COMPONENT>): State.JIT<COMPONENT | undefined>;
        getStateForClosest<COMPONENT extends Component>(builder: Component.Extension<any[], COMPONENT>): State.JIT<COMPONENT | undefined>;
        get parent(): Component | undefined;
        /** Gets all ancestors of this component that have an associated component */
        getAncestorComponents(): Generator<Component>;
        /** Gets all ancestors of this component that have an associated component of the given type */
        getAncestorComponents<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>;
        get previousSibling(): Component | undefined;
        /** Gets the previous sibling component of the given type */
        getPreviousSibling<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined;
        get nextSibling(): Component | undefined;
        /** Gets the next sibling component of the given type */
        getNextSibling<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined;
        /** Iterates through all children that have an associated component */
        getChildren(): Generator<Component>;
        /** Iterates through all children that have an associated component of the given type */
        getChildren<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>;
        /** Iterates through all siblings that have an associated component */
        getSiblings(): Generator<Component>;
        /** Iterates through all children that have an associated component of the given type */
        getSiblings<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>;
        /** Iterates through all siblings before this component that have an associated component (in actual order) */
        getPreviousSiblings(): Generator<Component>;
        /** Iterates through all children that have an associated component of the given type */
        getPreviousSiblings<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>;
        /** Iterates through all siblings after this component that have an associated component */
        getNextSiblings(): Generator<Component>;
        /** Iterates through all children that have an associated component of the given type */
        getNextSiblings<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>;
        /** Iterates through all descendants that have an associated component */
        getDescendants(): Generator<Component>;
        /** Iterates through all descendants that have an associated component of the given type */
        getDescendants<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>;
        /** Iterates through all descendants that have an associated component */
        getFirstDescendant(): Component | undefined;
        /** Iterates through all descendants that have an associated component of the given type */
        getFirstDescendant<COMPONENT extends Component>(filterBuilder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined;
        remove(): void;
        removeContents(): this;
        receiveRootedEvents(): this;
        receiveAncestorInsertEvents(): this;
        receiveInsertEvents(): this;
        receiveDescendantInsertEvents(): this;
        receiveDescendantRemoveEvents(): this;
        receiveAncestorScrollEvents(): this;
        receiveChildrenInsertEvents(): this;
        emitInsert(): this;
        monitorScrollEvents(): this;
        onRooted(callback: (component: this) => unknown): this;
        onRemove(owner: Component, callback: (component: this) => unknown): this;
        onRemoveManual(callback: (component: this) => unknown): this;
        ariaRole(role?: AriaRole): this;
        ariaLabel: StringApplicator.Optional<this>;
        ariaLabelledBy(component?: Component): this;
        ariaHidden(): this;
        ariaChecked(state: State<boolean>): this;
        ariaControls(component?: Component): this;
        tabIndex(index?: 'programmatic' | 'auto' | number): this;
        focus(): this;
        blur(): this;
    }
    interface Component<ELEMENT extends HTMLElement = HTMLElement> extends BaseComponent<ELEMENT>, ComponentExtensions<ELEMENT> {
    }
    function Component<TYPE extends keyof HTMLElementTagNameMap>(type: TYPE): Component<HTMLElementTagNameMap[TYPE]>;
    function Component(): Component<HTMLSpanElement>;
    function Component(type?: keyof HTMLElementTagNameMap): Component;
    function Component<PARAMS extends any[], COMPONENT extends Component>(builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component>(builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component | undefined>(builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component | undefined>(builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component | undefined>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>;
    function Component<PARAMS extends any[], COMPONENT extends Component | undefined>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>;
    namespace Component {
        export const getBody: () => Component<HTMLElement>;
        export const getDocument: () => Component<HTMLElement>;
        export const getWindow: () => Component<HTMLElement>;
        export function setComponentLibrarySource(source?: string): void;
        export function setStackSupplier(_stackSupplier: () => string): void;
        export function allowBuilding(): void;
        export function is(value: unknown): value is Component;
        export function element<NODE extends Node>(from: Component | NODE): NODE;
        export function wrap(element: HTMLElement): Component;
        export const SYMBOL_COMPONENT_TYPE_BRAND: unique symbol;
        export type BuilderLike<PARAMS extends any[] = any[], COMPONENT extends Component = Component> = Builder<PARAMS, COMPONENT> | Extension<PARAMS, COMPONENT>;
        export interface Builder<PARAMS extends any[], BUILD_COMPONENT extends Component | undefined> extends Omit<Extension<PARAMS, Exclude<BUILD_COMPONENT, undefined>>, 'setName' | 'builderType' | 'extend' | typeof SYMBOL_COMPONENT_TYPE_BRAND> {
            readonly builderType: 'builder';
            readonly [SYMBOL_COMPONENT_TYPE_BRAND]: BUILD_COMPONENT;
            (...params: PARAMS): BUILD_COMPONENT;
            setName(name: string): this;
            extend<T>(extensionProvider: (component: BUILD_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): BUILD_COMPONENT & T;
        }
        export interface BuilderAsync<PARAMS extends any[], BUILD_COMPONENT extends Component | undefined> extends Omit<ExtensionAsync<PARAMS, Exclude<BUILD_COMPONENT, undefined>>, 'setName' | 'builderType' | 'extend' | typeof SYMBOL_COMPONENT_TYPE_BRAND> {
            readonly builderType: 'builder';
            readonly [SYMBOL_COMPONENT_TYPE_BRAND]: BUILD_COMPONENT;
            (...params: PARAMS): Promise<BUILD_COMPONENT>;
            setName(name: string): this;
            extend<T>(extensionProvider: (component: BUILD_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): BUILD_COMPONENT & T;
        }
        export function Builder<PARAMS extends any[], COMPONENT extends Component>(builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component>(builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined>(builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined>(builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>;
        export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined>(initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>;
        export interface Extension<PARAMS extends any[], EXT_COMPONENT extends Component> {
            readonly builderType: 'extension';
            readonly [SYMBOL_COMPONENT_TYPE_BRAND]: EXT_COMPONENT;
            readonly name: BuilderName;
            from<COMPONENT extends Component>(component?: COMPONENT, ...params: PARAMS): COMPONENT & EXT_COMPONENT;
            setName(name: string): this;
            extend<T>(extensionProvider: (component: EXT_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): EXT_COMPONENT & T;
        }
        export interface ExtensionAsync<PARAMS extends any[], EXT_COMPONENT extends Component> {
            readonly builderType: 'extension';
            readonly [SYMBOL_COMPONENT_TYPE_BRAND]: EXT_COMPONENT;
            readonly name: BuilderName;
            from<COMPONENT extends Component>(component?: COMPONENT, ...params: PARAMS): Promise<COMPONENT & EXT_COMPONENT>;
            setName(name: string): this;
            extend<T>(extensionProvider: (component: EXT_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): EXT_COMPONENT & T;
        }
        export function Extension<PARAMS extends any[], COMPONENT extends Component>(builder: (component: Component, ...params: PARAMS) => COMPONENT): Extension<PARAMS, COMPONENT>;
        export function Extension<PARAMS extends any[], COMPONENT extends Component>(builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): ExtensionAsync<PARAMS, COMPONENT>;
        export function Tag(): Extension<[], Component<HTMLElement>>;
        export function extend(extension: (component: Mutable<Component>) => unknown): void;
        /**
         * Returns the component for the given element, if it exists
         */
        export function get(element?: unknown): Component | undefined;
        interface BuilderName extends String {
            kebabcase: string;
        }
        export function removeContents(element: Node): void;
        export function closest<BUILDERS extends Component.BuilderLike[]>(builder: BUILDERS, element?: HTMLElement | Component | null): {
            [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never;
        }[number];
        export function closest<BUILDER extends Component.BuilderLike>(builder: BUILDER, element?: HTMLElement | Component | null): (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined;
        export function closest<COMPONENT extends Component>(builder: Component.Builder<any[], COMPONENT>, element?: HTMLElement | Component | null): COMPONENT | undefined;
        export function closest<COMPONENT extends Component>(builder: Component.Extension<any[], COMPONENT>, element?: HTMLElement | Component | null): COMPONENT | undefined;
        export {};
    }
    export default Component;
}
declare module "kitsui" {
    import _Label, { LabelTarget as _LabelTarget } from "kitsui/component/Label";
    export { default as Component } from "kitsui/Component";
    export { default as State } from "kitsui/utility/State";
    export namespace Kit {
        type Label = _Label;
        const Label: import("Component").default.Builder<[], _Label>;
        type LabelTarget = _LabelTarget;
        const LabelTarget: import("Component").default.Extension<[], import("Component").default<HTMLElement>>;
    }
}
declare module "kitsui/utility/ActiveListener" {
    import type Component from "kitsui/Component";
    namespace ActiveListener {
        function allActive(): readonly Element[];
        function active(): Element | undefined;
        function allActiveComponents(): Generator<Component>;
        function activeComponent(): Component | undefined;
        function listen(): void;
    }
    export default ActiveListener;
}
declare module "kitsui/utility/Applicator" {
    import State from "kitsui/utility/State";
    interface Applicator<HOST, T> {
        readonly state: State<T>;
        set(value: T): HOST;
        bind(state: State<T>): HOST;
        unbind(): HOST;
        rehost<NEW_HOST>(newHost: NEW_HOST): Applicator<NEW_HOST, T>;
    }
    function Applicator<HOST, T>(host: HOST, apply: (value?: T) => unknown): Applicator.Optional<HOST, T>;
    function Applicator<HOST, T>(host: HOST, defaultValue: T, apply: (value: T) => unknown): Applicator<HOST, T>;
    namespace Applicator {
        interface Optional<HOST, T> extends Omit<Applicator<HOST, T>, 'state' | 'set' | 'bind' | 'rehost'> {
            state: State.Mutable<T | undefined | null>;
            set(value?: T | null): HOST;
            bind(state?: State<T | undefined | null>): HOST;
            rehost<NEW_HOST>(newHost: NEW_HOST): Applicator.Optional<NEW_HOST, T>;
        }
    }
    export default Applicator;
}
declare module "kitsui/utility/BrowserListener" {
    import State from "kitsui/utility/State";
    namespace BrowserListener {
        const isWebkit: State.Mutable<boolean>;
    }
    export default BrowserListener;
}
declare module "kitsui/utility/FontsListener" {
    import State from "kitsui/utility/State";
    namespace FontsListener {
        const loaded: State.Mutable<boolean>;
        function listen(): Promise<void>;
    }
    export default FontsListener;
}
declare module "kitsui/utility/HoverListener" {
    import type Component from "kitsui/Component";
    namespace HoverListener {
        function allHovered(): readonly Element[];
        function hovered(): Element | undefined;
        function allHoveredComponents(): Generator<Component>;
        function hoveredComponent(): Component | undefined;
        function listen(): void;
    }
    export default HoverListener;
}
declare module "kitsui/utility/PageListener" {
    import State from "kitsui/utility/State";
    namespace PageListener {
        const visible: State.Mutable<boolean>;
    }
    export default PageListener;
}
declare module "kitsui/utility/TypeManipulator" {
    import State from "kitsui/utility/State";
    interface TypeManipulator<HOST, TYPE extends string> {
        readonly state: State<ReadonlySet<TYPE>>;
        (...types: TYPE[]): HOST;
        remove(...types: TYPE[]): HOST;
        toggle(has: boolean, ...types: TYPE[]): HOST;
    }
    const TypeManipulator: <HOST, TYPE extends string>(host: HOST, onAdd: (types: TYPE[]) => unknown, onRemove: (types: TYPE[]) => unknown) => TypeManipulator<HOST, TYPE>;
    export default TypeManipulator;
}
