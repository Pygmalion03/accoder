import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        int current = scanner.nextInt();
        int best = current;
        for (int i = 1; i < n; i++) {
            int value = scanner.nextInt();
            current = Math.max(value, current + value);
            best = Math.max(best, current);
        }
        System.out.println(best);
    }
}
