import sys


def main():
    data = list(map(int, sys.stdin.read().split()))
    n = data[0]
    nums = data[1 : 1 + n]
    target = data[1 + n]
    seen = {}
    for index, value in enumerate(nums):
        need = target - value
        if need in seen:
            print(seen[need], index)
            return
        seen[value] = index


if __name__ == "__main__":
    main()
