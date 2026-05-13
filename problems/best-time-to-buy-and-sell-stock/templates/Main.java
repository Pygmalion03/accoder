import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        int minPrice = Integer.MAX_VALUE;
        int best = 0;
        for (int i = 0; i < n; i++) {
            int price = scanner.nextInt();
            minPrice = Math.min(minPrice, price);
            best = Math.max(best, price - minPrice);
        }
        System.out.println(best);
    }
}
