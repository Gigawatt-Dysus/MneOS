const arr: any[] = [{}];
try {
    console.log("TS Optional Chaining:", arr[1]?.name.toLowerCase());
} catch(e: any) {
    console.log("ERROR:", e.message);
}
